import { of, switchMap } from 'rxjs';

import {
  type CustomTransformOperator,
  type DataFrame,
  type DataTransformContext,
  type DataTransformerConfig,
  type PanelPlugin,
  transformDataFrame,
} from '@grafana/data';
import { FlagKeys, getFeatureFlagClient } from '@grafana/runtime/internal';
import {
  type CustomTransformerDefinition,
  SceneDataTransformer,
  type SceneDataTransformerState,
  type SceneObject,
  type SystemTransformationPosition,
  VizPanel,
  isSystemTransformation,
  isTransformationFrom,
  sceneGraph,
} from '@grafana/scenes';
import { DataTopic } from '@grafana/schema';
import { importPanelPlugin, syncGetPanelPlugin } from 'app/features/plugins/importPanelPlugin';

import { NO_SYSTEM_TRANSFORMATIONS, type ResolvedSystemTransformations } from './systemTransformations';

/**
 * A panel's data transformer, which additionally runs the transformations the panel's plugin
 * registered via `PanelPlugin.setDataTransformations`.
 *
 * State holds one wrapper operator per position, tagged `origin: 'plugin'`, not the plugin's configs
 * — those are resolved per emission by {@link getResolvedSystemTransformations}.
 */
export class PanelDataTransformer extends SceneDataTransformer {
  public constructor(state: SceneDataTransformerState) {
    // `cloneSceneObject` re-runs this constructor with cloned state and copies nested functions by
    // reference, so a clone arrives holding the source panel's wrapper operators. Dropping them here
    // is what keeps a duplicated panel on its own plugin's transformations.
    super({ ...state, transformations: state.transformations.filter((t) => !isSystemTransformation(t)) });

    this.addActivationHandler(() => this._activationHandler());
  }

  private _plugin?: PanelPlugin;

  /** Memoized supplier result, so both operators and every editor render share one call. */
  private _resolved?: { series: DataFrame[]; plugin: PanelPlugin; result: ResolvedSystemTransformations };

  /**
   * The single source of truth for both the wrapper operators and the editor, so the editor's
   * read-only rows name exactly what the pipeline will run. The cache keeps the returned identity
   * stable, which lets callers use these arrays as effect deps without a `useMemo`.
   *
   * @param series - Query result frames, before user transformations. Callers that already hold them
   *   should pass that same array so the cache hits.
   */
  public getResolvedSystemTransformations(series: DataFrame[]): ResolvedSystemTransformations {
    const panel = getAncestorVizPanel(this);
    const plugin = this._plugin;

    // Outside the cache: these can change without `series` or `plugin` changing. Re-reading the flag
    // lets the toggle stop a panel it already applies to; comparing plugin identity against live panel
    // state keeps a swap being answered by the outgoing plugin.
    if (!pluginTransformationsEnabled() || !panel || plugin?.meta.id !== panel.state.pluginId) {
      return NO_SYSTEM_TRANSFORMATIONS;
    }

    if (series.length === 0) {
      return NO_SYSTEM_TRANSFORMATIONS;
    }

    if (this._resolved?.series === series && this._resolved.plugin === plugin) {
      return this._resolved.result;
    }

    const { prepend, append } = plugin.getDataTransformations({ series });
    const result: ResolvedSystemTransformations =
      prepend.length === 0 && append.length === 0
        ? NO_SYSTEM_TRANSFORMATIONS
        : { prepend: prepend.filter(appliesToSeriesTopic), append: append.filter(appliesToSeriesTopic) };

    this._resolved = { series, plugin, result };

    return result;
  }

  private _runPrependedTransformations: CustomTransformOperator = (ctx) => (source) =>
    source.pipe(switchMap((frames) => this._applySystemTransformations('prepend', frames, ctx)));

  private _runAppendedTransformations: CustomTransformOperator = (ctx) => (source) =>
    source.pipe(switchMap((frames) => this._applySystemTransformations('append', frames, ctx)));

  /**
   * Resolves against the *source* frames, not the operator's own input: the appended operator is
   * handed the user's output, and `PanelDataTransformationsContext.series` is documented as the query
   * result. Reading the input would hand the supplier two different views in a single pass.
   */
  private _applySystemTransformations(
    position: SystemTransformationPosition,
    frames: DataFrame[],
    ctx: DataTransformContext
  ) {
    const configs = this.getResolvedSystemTransformations(this._sourceSeries())[position];

    return configs.length > 0 ? transformDataFrame(configs, frames, ctx) : of(frames);
  }

  /**
   * The frames the pipeline started from. Mirrors the base class's private `getSourceData()` — which
   * is why the graph fallback starts at `parent.parent`: the panel's `$data` is this object, so
   * resolving from `this` would return its own output.
   */
  private _sourceSeries(): DataFrame[] {
    const source = this.state.$data ?? (this.parent?.parent ? sceneGraph.getData(this.parent.parent) : undefined);

    return source?.state.data?.series ?? [];
  }

  private _activationHandler() {
    const panel = getAncestorVizPanel(this);

    if (!panel) {
      return;
    }

    this._syncSystemTransformations(panel);

    // Two things change the answer without producing new data: switching visualization, and the panel
    // finishing a plugin load that had not resolved yet. The second cannot be seen from `pluginId` —
    // `_pluginLoaded` writes the value already in state — so watch the plugin itself.
    let loadedPlugin = getLoadedPluginFor(panel);

    this._subs.add(
      panel.subscribeToState((newState, prevState) => {
        const nextPlugin = getLoadedPluginFor(panel);

        if (newState.pluginId === prevState.pluginId && nextPlugin === loadedPlugin) {
          return;
        }

        loadedPlugin = nextPlugin;
        this._syncSystemTransformations(panel);
      })
    );
  }

  /**
   * Installs only for panels whose plugin actually registers transformations. Installing
   * unconditionally would cost every panel on every dashboard: the base class's passthrough is gated
   * on `state.transformations.length === 0`, so one installed entry makes each emission rebuild
   * `PanelData` through the full pipeline even with nothing to run.
   *
   * Not done in the constructor: the plugin is reachable only through the panel, and `this.parent` is
   * not set yet at that point.
   */
  private _syncSystemTransformations(panel: VizPanel) {
    const plugin = getLoadedPluginFor(panel) ?? syncGetPanelPlugin(panel.state.pluginId);

    if (plugin) {
      this._installSystemTransformations(plugin);
      return;
    }

    // Every panel on every dashboard reaches this line, so while the feature is off the import below
    // would be an async plugin resolution per panel that can only ever decide to do nothing.
    if (!pluginTransformationsEnabled()) {
      return;
    }

    // Nothing resolves this id synchronously, and the panel may never load it — a provider can be
    // activated without its panel. Import from here rather than from the operator: `importPanelPlugin`
    // drops its cache entry on failure, so an operator awaiting it would re-reject every emission.
    const { pluginId } = panel.state;

    importPanelPlugin(pluginId)
      .then((imported) => {
        // The panel may have been swapped or the provider torn down while the chunk loaded.
        if (this.isActive && panel.state.pluginId === pluginId) {
          this._installSystemTransformations(imported);
        }
      })
      // An id nothing can resolve leaves the panel on its untransformed data, which is the same
      // outcome as a plugin that registers nothing. Never error the panel's data over it.
      .catch(() => undefined);
  }

  private _installSystemTransformations(plugin: PanelPlugin) {
    const shouldInstall = pluginTransformationsEnabled() && plugin.hasDataTransformations();
    const nextPlugin = shouldInstall ? plugin : undefined;
    // Scoped to this origin: `isSystemTransformation` matches every runtime entry, and
    // `setSystemTransformations` replaces one origin at a time, so counting another provider's
    // entries as ours would leave every sync with a mismatch it can never resolve.
    const isInstalled = this.state.transformations.some(isTransformationFrom('plugin'));

    // Idempotent, so re-activating a panel does not re-transform data that is already correct.
    if (nextPlugin === this._plugin && shouldInstall === isInstalled) {
      return;
    }

    this._plugin = nextPlugin;
    this._resolved = undefined;

    // Both positions install together: which half is non-empty depends on the frames, and an operator
    // resolving to nothing is a genuine no-op. Passing no groups clears this origin only.
    this.setSystemTransformations(
      shouldInstall
        ? { prepend: [this._wrapperFor('prepend', plugin)], append: [this._wrapperFor('append', plugin)] }
        : {}
    );
  }

  /**
   * Keyed so the base class can tell a real change from a no-op: it skips the update, and its own
   * reprocess, when the new transformations are equal, and without a key compares operators by
   * reference. Ours are stable per instance, so a swap between two registering plugins would look
   * like no change. The key carries the plugin id because that is what decides the output.
   */
  private _wrapperFor(position: SystemTransformationPosition, plugin: PanelPlugin): CustomTransformerDefinition {
    return {
      operator: position === 'prepend' ? this._runPrependedTransformations : this._runAppendedTransformations,
      topic: DataTopic.Series,
      key: `panel-plugin:${position}:${plugin.meta.id}`,
    };
  }
}

function pluginTransformationsEnabled(): boolean {
  return getFeatureFlagClient().getBooleanValue(FlagKeys.GrafanaPanelPluginTransformations, false);
}

/**
 * Qualified by `pluginId` because a panel holds a plugin for a different id while it swaps — a
 * library panel is built on a placeholder. Reading it unqualified would let the placeholder answer
 * for the real plugin and make the panel look resolved, so the sync would never revisit it.
 */
function getLoadedPluginFor(panel: VizPanel): PanelPlugin | undefined {
  const plugin = panel.getPlugin();

  return plugin?.meta.id === panel.state.pluginId ? plugin : undefined;
}

/**
 * Only series frames reach the wrapper operators: a returned config can carry a topic, but the
 * supplier's context field is `series`, so one targeting another topic would be misapplied.
 */
function appliesToSeriesTopic(transformation: DataTransformerConfig | CustomTransformOperator): boolean {
  if (typeof transformation === 'function') {
    return true;
  }

  return transformation.topic == null || transformation.topic === DataTopic.Series;
}

/** Walks up to the panel this provider feeds. Not `getClosestVizPanel` — that import would cycle. */
function getAncestorVizPanel(sceneObject: SceneObject): VizPanel | undefined {
  let current: SceneObject | undefined = sceneObject.parent;

  while (current) {
    if (current instanceof VizPanel) {
      return current;
    }
    current = current.parent;
  }

  return undefined;
}
