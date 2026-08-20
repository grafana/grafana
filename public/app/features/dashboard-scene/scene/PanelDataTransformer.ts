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
 * They live in `transformations` alongside the user's, tagged `origin: 'plugin'` by
 * `setSystemTransformations`, and are excluded from editors and serializers by the
 * `isSystemTransformation` guard. Prepended ones run first, which is what lets the user's
 * transformations and `VizPanel.applyFieldConfig` see the fields they produce.
 *
 * What actually sits in state is one opaque wrapper operator per position; the plugin's real configs
 * are resolved per emission by {@link getResolvedSystemTransformations}, because the supplier is
 * handed the frames and its answer can legitimately differ between refreshes. Resolving inside the
 * pipeline rather than pushing from a panel render is what keeps this free of a
 * render -> setState -> data -> render loop.
 *
 * Reactivity invariant, which the transformations editors rely on: every path that changes
 * `_plugin` ends in a `setState` on this object — either `transformations` changed, or the identity
 * check in `_installSystemTransformations` forced a reprocess and `transform()` wrote `data`. So a
 * component subscribed to this object's state re-renders after any plugin change, and the resolver
 * is already answering for the new plugin by then. That is strictly stronger than watching
 * `VizPanel.pluginId`, which does not change when a library panel's placeholder is replaced by the
 * real plugin, nor when a runtime-registered plugin lands under the id already in state.
 */
export class PanelDataTransformer extends SceneDataTransformer {
  public constructor(state: SceneDataTransformerState) {
    // `cloneSceneObject` re-runs this constructor with cloned state, and `cloneDeep` copies nested
    // functions by reference, so a clone arrives holding the *source* panel's wrapper operators — which
    // are bound to the source panel. Dropping every system entry here is what keeps a duplicated panel
    // on its own plugin's transformations; the activation handler installs this instance's own.
    super({ ...state, transformations: state.transformations.filter((t) => !isSystemTransformation(t)) });

    this.addActivationHandler(() => this._activationHandler());
  }

  /** The plugin the installed operators belong to, resolved once rather than per emission. */
  private _plugin?: PanelPlugin;

  /** Memoized supplier result, so both operators and every editor render share one call. */
  private _resolved?: { series: DataFrame[]; plugin: PanelPlugin; result: ResolvedSystemTransformations };

  /**
   * The transformations the panel's plugin asks for, given the frames the query produced, split by
   * where each group runs. The single source of truth: both wrapper operators and the transformations
   * editor read it, so the editor's read-only rows name exactly what the pipeline will run.
   *
   * Not pure — one result is cached so the two operators and every render of the editor share a single
   * supplier call. The cache key covers everything the answer depends on, so a stale answer is not
   * reachable, and the returned identity is stable, which is what lets callers use these arrays as
   * effect deps without a `useMemo`.
   *
   * @param series - Query result frames, before user transformations. Callers that already hold them
   *   (the editor reads them off the query runner) should pass that same array so the cache hits.
   */
  public getResolvedSystemTransformations(series: DataFrame[]): ResolvedSystemTransformations {
    const panel = getAncestorVizPanel(this);
    const plugin = this._plugin;

    // Deliberately outside the cache: the flag and the panel's `pluginId` are the two inputs that can
    // change without `series` or `plugin` changing. Re-reading the flag is what lets the toggle stop a
    // panel it already applies to. Checking plugin identity against live panel state is what keeps a
    // swap from being answered by the outgoing plugin — until the new one resolves, these frames
    // belong to neither.
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

  /** Runs the half of the plugin's transformations that goes before the user's. */
  private _runPrependedTransformations: CustomTransformOperator = (ctx) => (source) =>
    source.pipe(switchMap((frames) => this._applySystemTransformations('prepend', frames, ctx)));

  /** Runs the half that goes after the user's. */
  private _runAppendedTransformations: CustomTransformOperator = (ctx) => (source) =>
    source.pipe(switchMap((frames) => this._applySystemTransformations('append', frames, ctx)));

  /**
   * Resolves against the *source* frames rather than the operator's own input. Only the prepended
   * operator happens to receive those; the appended one is handed the user's output, and
   * `PanelDataTransformationsContext.series` is documented as the query result. Reading it off the
   * operator's input would quietly break that contract and hand the supplier two different views of
   * the data in a single pass.
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
   * The frames the pipeline started from. Mirrors the base class's private `getSourceData()`, which
   * is also why the graph fallback starts at `parent.parent`: the panel's `$data` is this object, so
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

    // Two things invalidate the decision above and neither produces new data, so nothing else would
    // re-run the pipeline: switching visualization (a different plugin, with a different answer), and
    // the panel finishing a plugin load that had not resolved yet. The second cannot be detected from
    // `pluginId` — `_pluginLoaded` writes the value already in state — so watch the plugin itself.
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
   * Installs the operators only for panels whose plugin actually registers transformations, and
   * removes them again when one no longer does.
   *
   * The alternative — installing unconditionally — costs every panel on every dashboard: the base
   * class's passthrough is gated on `state.transformations.length === 0`, so a single installed entry
   * makes each emission rebuild `PanelData` through the full pipeline even with nothing to run.
   *
   * Deliberately not done in the constructor: the plugin is reachable only through the panel, and
   * `this.parent` is not set yet at that point.
   */
  private _syncSystemTransformations(panel: VizPanel) {
    const plugin = getLoadedPluginFor(panel) ?? syncGetPanelPlugin(panel.state.pluginId);

    if (plugin) {
      this._installSystemTransformations(plugin);
      return;
    }

    // Resolving further is only worth it if there is something to install from the result. Every
    // panel on every dashboard reaches this line, so while the feature is off the import below would
    // be an async plugin resolution per panel that can only ever decide to do nothing. Skipping it
    // gives up no reachable behaviour: the branch above declines for the same reason once it has a
    // plugin in hand, so a flag enabled mid-session already does not retro-install either way.
    if (!pluginTransformationsEnabled()) {
      return;
    }

    // Nothing resolves this id synchronously, and the panel may never load it: a provider can be
    // activated on its own, without its panel — conditional rendering and the dashboard datasource's
    // source-panel path both do. Import it from here, once per resolution attempt, rather than from
    // the operator: `importPanelPlugin` deletes its promise cache entry on failure, so an operator
    // that awaited it would re-import and re-reject on every single emission.
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
    // Scoped to this origin rather than `isSystemTransformation`, which matches every runtime entry.
    // `setSystemTransformations` replaces one origin and leaves the rest alone, so counting another
    // provider's entries as ours would leave every sync with a mismatch it can never resolve.
    // 'plugin' is the only origin scenes defines today; scoping is what keeps this correct by
    // construction once a second one exists.
    const isInstalled = this.state.transformations.some(isTransformationFrom('plugin'));

    // Idempotent, so re-activating a panel does not re-transform data that is already correct.
    if (nextPlugin === this._plugin && shouldInstall === isInstalled) {
      return;
    }

    this._plugin = nextPlugin;
    this._resolved = undefined;

    const before = this.state.transformations;

    // Both positions install together: which half is non-empty depends on the frames, so it is not
    // known here. An operator that resolves to nothing is a genuine no-op — `transformDataFrame([])`
    // hands back the same array reference.
    //
    // Passing no groups clears this origin while preserving any other, which is what lets a second
    // runtime provider be added later without touching this.
    this.setSystemTransformations(
      shouldInstall ? { prepend: [this._runPrependedTransformations], append: [this._runAppendedTransformations] } : {}
    );

    // The base class bails out — and skips its own reprocess — when the resulting array is deep equal
    // to the current one. Our operators are stable bound references, so swapping between two plugins
    // that both register produces an equal array even though the operators' output changes, because
    // what they consult is `this._plugin`. Comparing identity is how the two cases are told apart
    // without reprocessing twice on a real install.
    if (this.state.transformations === before) {
      this.reprocessTransformations();
    }
  }
}

function pluginTransformationsEnabled(): boolean {
  return getFeatureFlagClient().getBooleanValue(FlagKeys.GrafanaPanelPluginTransformations, false);
}

/**
 * The panel's loaded plugin, but only when it is the plugin for the panel's current `pluginId`. A
 * panel holds one for a different id while it swaps: a library panel is built on a placeholder
 * plugin and `setPanelFromLibPanel` writes the real `pluginId` and this provider in a single
 * `setState`, so the placeholder is still loaded when this object activates.
 *
 * Reading it unqualified is wrong twice over — the placeholder answers the supplier call meant for
 * the real plugin, and it makes the panel look resolved, so `_syncSystemTransformations` settles on
 * the placeholder's answer and never revisits it. Comparing identity is also what lets the panel
 * subscription notice the real plugin arriving, since it lands under the `pluginId` already in state.
 */
function getLoadedPluginFor(panel: VizPanel): PanelPlugin | undefined {
  const plugin = panel.getPlugin();

  return plugin?.meta.id === panel.state.pluginId ? plugin : undefined;
}

/**
 * Only series frames reach the wrapper operators, in either position: a config the supplier returns
 * can carry a topic, but the supplier has no way to receive annotation frames — its context field is
 * `series`. A config targeting another topic would be misapplied to series data, so it is dropped
 * instead.
 */
function appliesToSeriesTopic(transformation: DataTransformerConfig | CustomTransformOperator): boolean {
  if (typeof transformation === 'function') {
    return true;
  }

  return transformation.topic == null || transformation.topic === DataTopic.Series;
}

/**
 * Walks up to the panel this provider feeds. Deliberately not `getClosestVizPanel` from
 * `../utils/utils` — importing that here creates a cycle, which is also why
 * `getVizSuggestionForQuery` and `DownloadDiagnostics` inline their own copies of
 * `getQueryRunnerFor`.
 */
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
