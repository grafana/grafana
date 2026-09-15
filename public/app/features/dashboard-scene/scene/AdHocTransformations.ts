import { mergeMap, tap } from 'rxjs';

import {
  type CustomTransformOperator,
  type DataFrame,
  type DataTransformerConfig,
  transformDataFrame,
} from '@grafana/data';
import {
  type ContributedTransformation,
  SceneDataTransformer,
  type SystemTransformationsProvider,
  type VizPanel,
} from '@grafana/scenes';
import { type AdHocTransformationsApi } from '@grafana/ui';

/** Attribution for everything this contributes, as seen by `getResolvedSystemTransformations`. */
export const AD_HOC_ORIGIN = 'adhoc';

const NO_CONFIGS: readonly DataTransformerConfig[] = Object.freeze([]);
const NO_SERIES: DataFrame[] = [];
Object.freeze(NO_SERIES);

/**
 * Holds one panel's ad-hoc transformations and contributes them to its data pipeline.
 *
 * Deliberately not a `SceneObject`: the configs are per-viewer state that must not read as a
 * dashboard change, must never be serialized, and must not be visible to the transformations
 * editors. Keeping them off scene state means no `SceneObjectStateChangedEvent` is ever published,
 * so `DashboardSceneChangeTracker` is not even consulted.
 */
export class AdHocTransformations implements SystemTransformationsProvider, AdHocTransformationsApi {
  public origin = AD_HOC_ORIGIN;

  private _configs: readonly DataTransformerConfig[] = NO_CONFIGS;
  private _listeners = new Set<() => void>();
  /** The frames that entered the stage on the last pass that ran it. */
  private _sourceSeries: DataFrame[] = NO_SERIES;
  /**
   * Memoized per config list. `SceneDataTransformer` compares what a provider resolved against the
   * last pass with `isEqual`, which compares functions by reference, so a fresh closure per call
   * would report a change on every re-activation and force a redundant pass.
   */
  private _stage?: CustomTransformOperator;

  public constructor(private _panel: VizPanel) {
    // A table's ad-hoc organize means nothing once the panel is a timeseries.
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
    this._stage = undefined;

    if (this._configs.length === 0) {
      // Nothing captures while the stage is off, so holding the frames would just retain them.
      this._sourceSeries = NO_SERIES;
    }

    // Listeners first, so a control reflects the click before the pipeline catches up — the same
    // order a user transformation edit lands in.
    for (const listener of Array.from(this._listeners)) {
      listener();
    }

    // Unconditional: the transformer memoizes what a provider resolved against the source series
    // identity, and the source has not changed here.
    this._panel.notifySystemTransformationsChanged();
  }

  public subscribe(callback: () => void): () => void {
    this._listeners.add(callback);

    return () => this._listeners.delete(callback);
  }

  public getSourceSeries(): DataFrame[] {
    // With the stage off nothing is captured, and the pipeline output *is* the stage input.
    if (this._configs.length === 0) {
      return getTransformerFor(this._panel)?.state.data?.series ?? NO_SERIES;
    }

    return this._sourceSeries;
  }

  /**
   * @internal
   * SystemTransformationsProvider.
   */
  public getSystemTransformations(): { append?: ContributedTransformation[] } {
    // Contributing nothing keeps `SceneDataTransformer`'s passthrough path for a panel that has a
    // stage available but is not using it, which is every panel most of the time.
    if (this._configs.length === 0) {
      return {};
    }

    return { append: [this._stageOperator()] };
  }

  /**
   * One operator that captures the frames entering the stage and then applies the configs.
   *
   * Bundled rather than contributed as a capture entry plus the configs, so the capture point is
   * exactly the stage input however the tiers around it are ordered, and so `disabled`, `filter`
   * and transformer defaults are all handled by the nested `transformDataFrame`.
   */
  private _stageOperator(): CustomTransformOperator {
    this._stage ??= (ctx) => (source) =>
      source.pipe(
        // Capture only. Notifying subscribers here would render new source frames against the panel
        // data of the previous pass, and on a shared channel would loop back into this pass.
        tap((frames) => {
          this._sourceSeries = frames;
        }),
        mergeMap((frames) => transformDataFrame(Array.from(this._configs), frames, ctx))
      );

    return this._stage;
  }
}

/** One holder per panel, for as long as the panel is reachable. */
const holders = new WeakMap<VizPanel, AdHocTransformations>();

function getTransformerFor(panel: VizPanel): SceneDataTransformer | undefined {
  return panel.state.$data instanceof SceneDataTransformer ? panel.state.$data : undefined;
}

/**
 * The ad-hoc transformation stage for a panel, or undefined when it cannot have one.
 *
 * Resolved on every access rather than once per panel: a library panel acquires its `$data` after
 * its panel context has been built, so a decision cached at build time would be permanently wrong.
 * The instance itself is stable, which is what lets panels use it in a dependency array.
 */
export function getAdHocTransformations(panel: VizPanel): AdHocTransformations | undefined {
  if (!getTransformerFor(panel)) {
    return undefined;
  }

  let holder = holders.get(panel);

  if (!holder) {
    holder = new AdHocTransformations(panel);
    holders.set(panel, holder);
    // Registering lazily keeps a panel that never touches ad-hoc out of the pipeline's way
    // entirely. The transformer resolves providers on every pass, so registering late is fine.
    panel.addSystemTransformationsProvider(holder);
  }

  return holder;
}
