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

// This is deliberately not a SceneObject: ad-hoc transformations must not dirty or serialize with
// the dashboard.
export class AdHocTransformations implements AdHocTransformationsApi {
  private _configs: readonly DataTransformerConfig[] = NO_CONFIGS;
  private _listeners = new Set<() => void>();
  private _sourceSeries: readonly DataFrame[] = NO_SERIES;
  private _stage = this._createStageOperator();

  public constructor(private _panel: VizPanel) {
    _panel.subscribeToState((next, prev) => {
      if (next.pluginId !== prev.pluginId && this._configs.length > 0) {
        this.set([]);
      }
    });
  }

  public get(): readonly DataTransformerConfig[] {
    return this._configs;
  }

  public set(transformations: DataTransformerConfig[]): void {
    this._configs = transformations.length === 0 ? NO_CONFIGS : Object.freeze([...transformations]);
    // SceneDataTransformer compares operators by reference when deciding whether to reprocess.
    this._stage = this._createStageOperator();

    if (this._configs.length > 0 && this._panel.state._UNSAFE_clearPreviousFieldValues) {
      // Hidden fields must retain their values so they can be restored without a refetch.
      this._panel.setState({ _UNSAFE_clearPreviousFieldValues: false });
    }

    if (this._configs.length === 0) {
      this._sourceSeries = NO_SERIES;
    }

    for (const listener of Array.from(this._listeners)) {
      listener();
    }

    getTransformerFor(this._panel)?.reprocessTransformations();
  }

  public subscribe(callback: () => void): () => void {
    this._listeners.add(callback);

    return () => this._listeners.delete(callback);
  }

  public getSourceSeries(): readonly DataFrame[] {
    if (this._configs.length === 0) {
      return getTransformerFor(this._panel)?.state.data?.series ?? NO_SERIES;
    }

    return this._sourceSeries;
  }

  public getSystemTransformations(): { append?: CustomTransformOperator[] } {
    if (this._configs.length === 0) {
      return {};
    }

    return { append: [this._stage] };
  }

  private _createStageOperator(): CustomTransformOperator {
    return (ctx) => (source) =>
      source.pipe(
        tap((frames) => {
          this._sourceSeries = frames;
        }),
        mergeMap((frames) => transformDataFrame(Array.from(this._configs), frames, ctx))
      );
  }
}

const holders = new WeakMap<VizPanel, AdHocTransformations>();

function getTransformerFor(panel: VizPanel): SceneDataTransformer | undefined {
  return panel.state.$data instanceof SceneDataTransformer ? panel.state.$data : undefined;
}

export function getAdHocTransformations(panel: VizPanel): AdHocTransformations | undefined {
  if (!getTransformerFor(panel)) {
    return undefined;
  }

  const existing = holders.get(panel);

  if (existing) {
    return existing;
  }

  const holder = new AdHocTransformations(panel);
  holders.set(panel, holder);

  // Compose onto the panel instance so the singleton plugin holds no per-panel state.
  const getPanelSystemTransformations = panel.getSystemTransformations.bind(panel);
  panel.getSystemTransformations = (ctx) => {
    const panelTransformations = getPanelSystemTransformations(ctx);
    const adHocTransformations = holder.getSystemTransformations();

    return {
      ...panelTransformations,
      append: [...(panelTransformations.append ?? []), ...(adHocTransformations.append ?? [])],
    };
  };

  return holder;
}
