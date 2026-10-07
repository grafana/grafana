import type { QueryResultMetaNotice } from '../types/data';
import type { DataQueryError } from '../types/datasource';
import type { PanelData } from '../types/panel';
import type { DataQuery } from '../types/query';

/** A frontend-only action. Never persist callbacks in query responses or dashboard JSON. @alpha */
export interface PanelDiagnosticAction {
  id: string;
  label: string;
  onClick: () => void | Promise<void>;
  disabled?: boolean;
  disabledReason?: string;
}

/** @alpha */
export interface PanelDiagnosticActions {
  actions?: readonly PanelDiagnosticAction[];
  assistant?: 'default' | 'hidden';
}

/** @alpha */
export interface PanelDiagnostic extends PanelDiagnosticActions {
  id: string;
  severity: 'error' | 'warning' | 'info';
  text: string;
}

/** @alpha */
export interface PanelDiagnosticEntry extends PanelDiagnostic {
  origin: 'panel' | 'query' | 'notice' | 'plugin-load';
  datasourceUid?: string;
  refId?: string;
  error?: DataQueryError;
  notice?: QueryResultMetaNotice;
  detail?: string;
  link?: string;
}

/** @alpha */
export interface PanelDiagnosticActionContext {
  data?: PanelData;
  query?: DataQuery;
}

/** @alpha */
export type PanelDiagnosticActionResolver = (
  diagnostic: Readonly<PanelDiagnosticEntry>
) => PanelDiagnosticActions | undefined;

/** Owns one isolated set of diagnostics and action contributions. @alpha */
export interface PanelDiagnosticSource {
  set(items: readonly PanelDiagnostic[]): void;
  setActionResolver(resolver?: PanelDiagnosticActionResolver): void;
  dispose(): void;
}

/** @alpha */
export interface PanelDiagnosticActionState {
  pending?: boolean;
  error?: string;
}

/** @alpha */
export interface PanelDiagnosticsSnapshot {
  generation: number;
  items: readonly PanelDiagnosticEntry[];
  actions: Readonly<Record<string, PanelDiagnosticActionState>>;
}

/** @alpha */
export interface PanelDiagnostics {
  createSource(): PanelDiagnosticSource;
  getSnapshot(): PanelDiagnosticsSnapshot;
  subscribe(listener: () => void): () => void;
  runAction(diagnosticId: string, actionId: string): Promise<void>;
}

const rank = { error: 3, warning: 2, info: 1 };

/** Normalize query diagnostics without changing their serializable payloads. @alpha */
export function getPanelDataDiagnostics(data?: PanelData, pluginLoadingError?: string): PanelDiagnosticEntry[] {
  const entries: PanelDiagnosticEntry[] = [];
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
export class PanelDiagnosticsStore implements PanelDiagnostics {
  private nextSource = 0;
  private sources = new Map<number, { items: readonly PanelDiagnostic[]; resolver?: PanelDiagnosticActionResolver }>();
  private external: readonly PanelDiagnosticEntry[] = [];
  private datasourceResolver?: PanelDiagnosticActionResolver;
  private listeners = new Set<() => void>();
  private snapshot: PanelDiagnosticsSnapshot = { generation: 0, items: [], actions: {} };
  private pending = new Map<string, object>();

  getSnapshot = () => this.snapshot;

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  createSource = (): PanelDiagnosticSource => {
    const id = this.nextSource++;
    const source: { items: readonly PanelDiagnostic[]; resolver?: PanelDiagnosticActionResolver } = { items: [] };
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

  /** Replaces only host-provided diagnostics. @alpha */
  setExternal(items: readonly PanelDiagnosticEntry[], datasourceResolver?: PanelDiagnosticActionResolver) {
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

  runAction = async (diagnosticId: string, actionId: string) => {
    const item = this.snapshot.items.find((item) => item.id === diagnosticId);
    const action = item?.actions?.find((action) => action.id === actionId);
    const key = JSON.stringify([diagnosticId, actionId]);
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

  private setActionState(key: string, state: PanelDiagnosticActionState) {
    this.snapshot = { ...this.snapshot, actions: { ...this.snapshot.actions, [key]: state } };
    this.emit();
  }

  private rebuild() {
    const base: PanelDiagnosticEntry[] = [
      ...this.external.map((item) => ({ ...item, id: `external:${item.id}` })),
      ...Array.from(this.sources, ([id, source]) =>
        source.items.map((item): PanelDiagnosticEntry => ({ ...item, id: `source:${id}:${item.id}`, origin: 'panel' }))
      ).flat(),
    ];
    const items = base
      .map((item) => {
        const actions: PanelDiagnosticAction[] = [];
        let assistant = item.assistant;
        const merge = (owner: string, contribution?: PanelDiagnosticActions) => {
          if (contribution?.assistant === 'hidden') {
            assistant = 'hidden';
          }
          for (const action of contribution?.actions ?? []) {
            actions.push({ ...action, id: JSON.stringify([owner, action.id]) });
          }
        };
        const resolve = (owner: string, resolver?: PanelDiagnosticActionResolver) => {
          try {
            merge(owner, resolver?.(item));
          } catch (error) {
            console.error('Panel diagnostic action resolver failed', error);
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
    const actions: Record<string, PanelDiagnosticActionState> = {};
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
