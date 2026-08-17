import { of, switchMap } from 'rxjs';

import {
  type CustomTransformOperator,
  type DataTransformerConfig,
  type PanelPlugin,
  transformDataFrame,
} from '@grafana/data';
import { FlagKeys, getFeatureFlagClient } from '@grafana/runtime/internal';
import { SceneDataTransformer, type SceneDataTransformerState, type SceneObject, VizPanel } from '@grafana/scenes';
import { DataTopic } from '@grafana/schema';
import { importPanelPlugin, syncGetPanelPlugin } from 'app/features/plugins/importPanelPlugin';

/**
 * A panel's data transformer, which additionally runs the transformations the panel's plugin
 * registered via `PanelPlugin.setDataTransformations`.
 *
 * They are held in `systemTransformations`, which the base class splices ahead of the user's
 * `transformations` at transform time. Running first is what lets the user's transformations and
 * `VizPanel.applyFieldConfig` see the fields they produce; staying out of `transformations` — the
 * only list editors and serializers read — is what makes them non-editable and non-persisted.
 */
export class PanelDataTransformer extends SceneDataTransformer {
  public constructor(state: SceneDataTransformerState) {
    // `cloneSceneObject` re-runs this constructor with cloned state, so a clone arrives holding the *source* panel's operator,
    // which is bound to the source panel. Dropping it here is what keeps a duplicated panel on its own plugin's transformations.
    super({ ...state, systemTransformations: undefined });

    this.addActivationHandler(() => this._activationHandler());
  }

  /** The plugin the installed operator belongs to, resolved once rather than per emission. */
  private _plugin?: PanelPlugin;

  /**
   * Asks the plugin for its transformations per emission rather than caching the result: the supplier
   * receives the frames, so its answer can legitimately differ between refreshes.
   *
   * The plugin itself is not re-resolved here. `_syncSystemTransformations` owns that, because the
   * only way to reach some ids is an async import — an operator cannot await one without making the
   * whole pipeline asynchronous on every emission.
   */
  private _runPluginTransformations: CustomTransformOperator = (ctx) => (source) =>
    source.pipe(
      switchMap((frames) => {
        // Re-read rather than reuse the install-time result: flag values change over a session, so
        // caching one would leave the toggle unable to stop a panel it already applies to.
        if (!pluginTransformationsEnabled() || frames.length === 0) {
          return of(frames);
        }

        const panel = getAncestorVizPanel(this);
        const plugin = this._plugin;

        // Only ever answer for the panel's current plugin. A swap re-syncs through the subscription
        // below; until the new plugin resolves these frames belong to neither, so pass them through.
        if (!panel || plugin?.meta.id !== panel.state.pluginId) {
          return of(frames);
        }

        const configs = plugin.getDataTransformations({ series: frames }).filter(appliesToSeriesTopic);

        return transformDataFrame(configs, frames, ctx);
      })
    );

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
   * Installs the operator only for panels whose plugin actually registers transformations, and
   * removes it again when one no longer does.
   *
   * The alternative — installing unconditionally — is what it replaces, and it costs every panel on
   * every dashboard: a non-empty `getEffectiveTransformations()` permanently disables the base
   * class's passthrough, so each emission rebuilds `PanelData` through the full pipeline even when
   * there is nothing to run.
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
    const isInstalled = Boolean(this.state.systemTransformations?.prepend?.length);

    // Idempotent, so re-activating a panel does not re-transform data that is already correct.
    if (nextPlugin === this._plugin && shouldInstall === isInstalled) {
      return;
    }

    this._plugin = nextPlugin;

    // Swapping between two plugins that both register transformations leaves the operator in place,
    // but its output changes, so the pipeline still has to re-run.
    if (shouldInstall !== isInstalled) {
      this.setState({
        systemTransformations: shouldInstall ? { prepend: [this._runPluginTransformations] } : undefined,
      });
    }

    this.reprocessTransformations();
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
 * Only series frames reach the operator: `systemTransformations` entries can carry a topic, but a
 * bare operator is series-only, and the supplier has no way to receive annotation frames — its
 * context field is `series`. A config targeting another topic would be misapplied to series data,
 * so it is dropped instead.
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
