import { mergeMap, tap } from 'rxjs';

import {
  type CustomTransformOperator,
  type DataFrame,
  type DataTransformerConfig,
  transformDataFrame,
} from '@grafana/data';
import { SceneDataTransformer, type VizPanel } from '@grafana/scenes';
import { type AdHocTransformationsApi } from '@grafana/ui';

const NO_CONFIGS: readonly DataTransformerConfig[] = Object.freeze([]);
const NO_SERIES: readonly DataFrame[] = Object.freeze([]);

class RuntimeTransformationGroup {
  public configs: readonly DataTransformerConfig[] = NO_CONFIGS;
  public listeners = new Set<() => void>();
  public sourceSeries: readonly DataFrame[] = NO_SERIES;
  public operator: CustomTransformOperator = (ctx) => (source) =>
    source.pipe(
      tap((frames) => {
        this.sourceSeries = frames;
      }),
      mergeMap((frames) => transformDataFrame(Array.from(this.configs), frames, ctx))
    );

  public notify(): void {
    for (const listener of Array.from(this.listeners)) {
      listener();
    }
  }
}

// This is deliberately not a SceneObject: ad-hoc transformations must not dirty or serialize with
// the dashboard.
export class AdHocTransformations implements AdHocTransformationsApi {
  private _groups = new Map<string, RuntimeTransformationGroup>();

  public constructor(private _panel: VizPanel) {
    _panel.subscribeToState((next, prev) => {
      if (next.pluginId !== prev.pluginId) {
        this._clearAll(prev.$data);
        return;
      }

      if (next.$data !== prev.$data) {
        this._moveGroups(prev.$data, next.$data);
      }
    });
  }

  public get(tag: string): readonly DataTransformerConfig[] {
    return this._groups.get(tag)?.configs ?? NO_CONFIGS;
  }

  public set(tag: string, transformations: readonly DataTransformerConfig[]): void {
    const group = this._getOrCreateGroup(tag);
    group.configs = transformations.length === 0 ? NO_CONFIGS : Object.freeze([...transformations]);

    if (group.configs.length > 0 && this._panel.state._UNSAFE_clearPreviousFieldValues) {
      // Hidden fields must retain their values so they can be restored without a refetch.
      this._panel.setState({ _UNSAFE_clearPreviousFieldValues: false });
    }

    const transformer = getTransformer(this._panel.state.$data);
    if (group.configs.length > 0) {
      transformer?.upsertRuntimeTransformations({ tag, transformations: [group.operator] });
    } else {
      group.sourceSeries = NO_SERIES;
      transformer?.removeRuntimeTransformations(tag);
    }

    group.notify();
  }

  public subscribe(tag: string, callback: () => void): () => void {
    const listeners = this._getOrCreateGroup(tag).listeners;
    listeners.add(callback);

    return () => listeners.delete(callback);
  }

  public getSourceSeries(tag: string): readonly DataFrame[] {
    const group = this._groups.get(tag);
    if (!group || group.configs.length === 0) {
      return getTransformer(this._panel.state.$data)?.state.data?.series ?? NO_SERIES;
    }

    return group.sourceSeries;
  }

  private _getOrCreateGroup(tag: string): RuntimeTransformationGroup {
    let group = this._groups.get(tag);
    if (group) {
      return group;
    }

    group = new RuntimeTransformationGroup();
    this._groups.set(tag, group);
    return group;
  }

  private _moveGroups(previousData: unknown, nextData: unknown): void {
    const previousTransformer = getTransformer(previousData);
    const nextTransformer = getTransformer(nextData);

    for (const [tag, group] of this._groups) {
      if (group.configs.length === 0) {
        continue;
      }

      previousTransformer?.removeRuntimeTransformations(tag);
      group.sourceSeries = NO_SERIES;
      nextTransformer?.upsertRuntimeTransformations({ tag, transformations: [group.operator] });
    }
  }

  private _clearAll(data: unknown): void {
    const transformer = getTransformer(data);

    for (const [tag, group] of this._groups) {
      if (group.configs.length === 0) {
        continue;
      }

      transformer?.removeRuntimeTransformations(tag);
      group.configs = NO_CONFIGS;
      group.sourceSeries = NO_SERIES;
      group.notify();
    }
  }
}

const holders = new WeakMap<VizPanel, AdHocTransformations>();

function getTransformer(data: unknown): SceneDataTransformer | undefined {
  return data instanceof SceneDataTransformer ? data : undefined;
}

export function getAdHocTransformations(panel: VizPanel): AdHocTransformations | undefined {
  if (!getTransformer(panel.state.$data)) {
    return undefined;
  }

  const existing = holders.get(panel);

  if (existing) {
    return existing;
  }

  const holder = new AdHocTransformations(panel);
  holders.set(panel, holder);
  return holder;
}
