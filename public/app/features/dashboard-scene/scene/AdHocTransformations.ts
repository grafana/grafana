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
  configs: readonly DataTransformerConfig[] = NO_CONFIGS;
  listeners = new Set<() => void>();
  sourceSeries: readonly DataFrame[] = NO_SERIES;
  operator: CustomTransformOperator = (ctx) => (source) =>
    source.pipe(
      tap((frames) => {
        this.sourceSeries = frames;
      }),
      mergeMap((frames) => transformDataFrame(Array.from(this.configs), frames, ctx))
    );
}

// This is deliberately not a SceneObject: ad-hoc transformations must not dirty or serialize with
// the dashboard.
class AdHocTransformations implements AdHocTransformationsApi {
  private _groups = new Map<string, RuntimeTransformationGroup>();

  public constructor(private _panel: VizPanel) {
    _panel.subscribeToState((next, prev) => {
      if (next.pluginId !== prev.pluginId) {
        this._updateTransformer(prev.$data, undefined, true);
        return;
      }

      if (next.$data !== prev.$data) {
        this._updateTransformer(prev.$data, next.$data);
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

    for (const listener of Array.from(group.listeners)) {
      listener();
    }
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
    if (!group) {
      group = new RuntimeTransformationGroup();
      this._groups.set(tag, group);
    }

    return group;
  }

  private _updateTransformer(previousData: unknown, nextData: unknown, clear = false): void {
    const previousTransformer = getTransformer(previousData);
    const nextTransformer = getTransformer(nextData);

    for (const [tag, group] of this._groups) {
      if (group.configs.length === 0) {
        continue;
      }

      previousTransformer?.removeRuntimeTransformations(tag);
      group.sourceSeries = NO_SERIES;
      if (clear) {
        group.configs = NO_CONFIGS;
        for (const listener of Array.from(group.listeners)) {
          listener();
        }
      } else {
        nextTransformer?.upsertRuntimeTransformations({ tag, transformations: [group.operator] });
      }
    }
  }
}

function getTransformer(data: unknown): SceneDataTransformer | undefined {
  return data instanceof SceneDataTransformer ? data : undefined;
}

export function createAdHocTransformations(panel: VizPanel): AdHocTransformationsApi | undefined {
  return getTransformer(panel.state.$data) ? new AdHocTransformations(panel) : undefined;
}
