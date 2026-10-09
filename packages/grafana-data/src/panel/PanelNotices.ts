import type { QueryResultMetaNotice } from '../types/data';
import type { DataQueryError } from '../types/datasource';
import type { PanelData } from '../types/panel';
import type { DataQuery } from '../types/query';

/** A frontend-only action. Never persist callbacks in query responses or dashboard JSON. @alpha */
export interface PanelStatusAction {
  id: string;
  label: string;
  onClick: () => void | Promise<void>;
  disabled?: boolean;
  disabledReason?: string;
}

/** @alpha */
export interface PanelStatusActions {
  actions?: readonly PanelStatusAction[];
  assistant?: 'default' | 'hidden';
}

/** An error, warning, or informational notice published by a panel plugin. @alpha */
export interface PanelNotice extends PanelStatusActions {
  id: string;
  severity: 'error' | 'warning' | 'info';
  text: string;
}

/** A normalized panel status item, including its provenance. @alpha */
export interface PanelStatusItem extends PanelNotice {
  origin: 'panel' | 'query' | 'notice' | 'plugin-load';
  datasourceUid?: string;
  refId?: string;
  error?: DataQueryError;
  notice?: QueryResultMetaNotice;
  detail?: string;
  link?: string;
}

/** @alpha */
export interface PanelStatusActionContext {
  data?: PanelData;
  query?: DataQuery;
}

/** @alpha */
export type PanelStatusActionResolver = (statusItem: Readonly<PanelStatusItem>) => PanelStatusActions | undefined;

/** Owns one isolated set of notices and action contributions. @alpha */
export interface PanelNoticeSource {
  set(items: readonly PanelNotice[]): void;
  setActionResolver(resolver?: PanelStatusActionResolver): void;
  dispose(): void;
}

/** @alpha */
export interface PanelStatusActionState {
  pending?: boolean;
  error?: string;
}

/** @alpha */
export interface PanelStatusSnapshot {
  generation: number;
  items: readonly PanelStatusItem[];
  actions: Readonly<Record<string, PanelStatusActionState>>;
}

/** @alpha */
export interface PanelNotices {
  createSource(): PanelNoticeSource;
  getSnapshot(): PanelStatusSnapshot;
  subscribe(listener: () => void): () => void;
  runAction(statusItemId: string, actionId: string): Promise<void>;
}

const rank = { error: 3, warning: 2, info: 1 };

/** Normalize query errors, notices, and plugin loading errors without changing their payloads. @alpha */
export function getPanelDataStatusItems(data?: PanelData, pluginLoadingError?: string): PanelStatusItem[] {
  const entries: PanelStatusItem[] = [];
  if (pluginLoadingError) {
    entries.push({ id: 'plugin-load', origin: 'plugin-load', severity: 'error', text: pluginLoadingError });
  }
  const datasourceUid = (refId?: string) =>
    refId ? data?.request?.targets.find((query) => query.refId === refId)?.datasource?.uid : undefined;
  const occurrences = new Map<string, number>();
  for (const error of data?.errors ?? (data?.error ? [data.error] : [])) {
    let detail: string;
    try {
      detail = JSON.stringify(error.data ?? error, null, 2);
    } catch {
      detail = error.message ?? String(error);
    }
    const uid = datasourceUid(error.refId);
    const text = error.message ?? error.data?.message ?? 'Query error';
    const key = JSON.stringify(['query', uid, error.refId, text, detail]);
    const occurrence = occurrences.get(key) ?? 0;
    occurrences.set(key, occurrence + 1);
    entries.push({
      id: `${key}:${occurrence}`,
      origin: 'query',
      severity: 'error',
      text,
      detail,
      error,
      refId: error.refId,
      datasourceUid: uid,
    });
  }
  const seen = new Set<string>();
  for (const frame of data?.series ?? []) {
    for (const notice of frame.meta?.notices ?? []) {
      const uid = datasourceUid(frame.refId);
      const severity = notice.severity ?? 'info';
      const key = JSON.stringify(['notice', uid, frame.refId, severity, notice.text, notice.link]);
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      entries.push({
        id: key,
        origin: 'notice',
        severity,
        text: notice.text,
        notice,
        link: notice.link,
        refId: frame.refId,
        datasourceUid: uid,
      });
    }
  }
  return entries;
}

/** Runtime state owned by one panel host, never by serialized scene state. @alpha */
export class PanelStatusStore implements PanelNotices {
  private nextSource = 0;
  private sources = new Map<number, { items: readonly PanelNotice[]; resolver?: PanelStatusActionResolver }>();
  private external: readonly PanelStatusItem[] = [];
  private datasourceResolver?: PanelStatusActionResolver;
  private listeners = new Set<() => void>();
  private snapshot: PanelStatusSnapshot = { generation: 0, items: [], actions: {} };
  private pending = new Map<string, object>();

  getSnapshot = () => this.snapshot;

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  createSource = (): PanelNoticeSource => {
    const id = this.nextSource++;
    const source: { items: readonly PanelNotice[]; resolver?: PanelStatusActionResolver } = { items: [] };
    this.sources.set(id, source);
    return {
      set: (items) => {
        if (this.sources.get(id) !== source) {
          return;
        }
        source.items = [...new Map(items.map((item) => [item.id, item])).values()];
        this.rebuild();
      },
      setActionResolver: (resolver) => {
        if (this.sources.get(id) !== source) {
          return;
        }
        source.resolver = resolver;
        this.rebuild();
      },
      dispose: () => {
        if (this.sources.delete(id)) {
          this.rebuild();
        }
      },
    };
  };

  /** Replaces only host-provided status items. @alpha */
  setExternal(items: readonly PanelStatusItem[], datasourceResolver?: PanelStatusActionResolver) {
    this.external = items;
    this.datasourceResolver = datasourceResolver;
    this.rebuild();
  }

  /** Refresh actions when host capabilities change without a data update. @alpha */
  refresh() {
    this.rebuild();
  }

  /** Invalidates handles and in-flight actions when a panel is deactivated or replaced. @alpha */
  clear() {
    this.sources.clear();
    this.external = [];
    this.datasourceResolver = undefined;
    this.pending.clear();
    this.snapshot = { generation: this.snapshot.generation + 1, items: [], actions: {} };
    this.emit();
  }

  runAction = async (statusItemId: string, actionId: string) => {
    const item = this.snapshot.items.find((item) => item.id === statusItemId);
    const action = item?.actions?.find((action) => action.id === actionId);
    const key = JSON.stringify([statusItemId, actionId]);
    if (!action || action.disabled || this.pending.has(key)) {
      return;
    }
    const token = {};
    this.pending.set(key, token);
    this.setActionState(key, { pending: true });
    let error: string | undefined;
    try {
      await action.onClick();
    } catch (cause) {
      error = cause instanceof Error ? cause.message : String(cause);
    } finally {
      if (this.pending.get(key) === token) {
        this.pending.delete(key);
        this.setActionState(key, { error });
      }
    }
  };

  private setActionState(key: string, state: PanelStatusActionState) {
    this.snapshot = { ...this.snapshot, actions: { ...this.snapshot.actions, [key]: state } };
    this.emit();
  }

  private rebuild() {
    const base: PanelStatusItem[] = [
      ...this.external.map((item) => ({ ...item, id: `external:${item.id}` })),
      ...Array.from(this.sources, ([id, source]) =>
        source.items.map((item): PanelStatusItem => ({ ...item, id: `source:${id}:${item.id}`, origin: 'panel' }))
      ).flat(),
    ];
    const items = base
      .map((item) => {
        const actions: PanelStatusAction[] = [];
        let assistant = item.assistant;
        const merge = (owner: string, contribution?: PanelStatusActions) => {
          if (contribution?.assistant === 'hidden') {
            assistant = 'hidden';
          }
          for (const action of contribution?.actions ?? []) {
            actions.push({ ...action, id: JSON.stringify([owner, action.id]) });
          }
        };
        const resolve = (owner: string, resolver?: PanelStatusActionResolver) => {
          try {
            merge(owner, resolver?.(item));
          } catch (error) {
            console.error('Panel status action resolver failed', error);
          }
        };
        merge('own', item);
        if (item.origin === 'query' || item.origin === 'notice') {
          resolve('datasource', this.datasourceResolver);
        }
        for (const [id, source] of this.sources) {
          resolve(`source:${id}`, source.resolver);
        }
        return { ...item, actions, assistant };
      })
      .sort((a, b) => rank[b.severity] - rank[a.severity]);
    const actions: Record<string, PanelStatusActionState> = {};
    for (const item of items) {
      for (const action of item.actions) {
        const key = JSON.stringify([item.id, action.id]);
        if (this.snapshot.actions[key]) {
          actions[key] = this.snapshot.actions[key];
        }
      }
    }
    for (const key of this.pending.keys()) {
      if (!actions[key]) {
        this.pending.delete(key);
      }
    }
    this.snapshot = { generation: this.snapshot.generation, items, actions };
    this.emit();
  }

  private emit() {
    this.listeners.forEach((listener) => listener());
  }
}
