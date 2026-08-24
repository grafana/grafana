import { type CustomTransformOperator, type DataTransformerConfig, type PanelPlugin } from '@grafana/data';
import {
  SceneDataTransformer,
  SceneObjectBase,
  type SceneObjectState,
  type SystemTransformationsSupplier,
  VizPanel,
} from '@grafana/scenes';
import { DataTopic } from '@grafana/schema';
import { importPanelPlugin, syncGetPanelPlugin } from 'app/features/plugins/importPanelPlugin';

import { pluginTransformationsEnabled } from './systemTransformations';

/**
 * Runs the transformations a panel's plugin registered through `PanelPlugin.setSystemTransformations`,
 * by handing the transformer a supplier that resolves them from the frames entering the pipeline.
 * Nothing it contributes reaches `state.transformations`, so persisting and the editors never see it.
 *
 * Belongs on the transformer's `$behaviors` rather than the panel's: a replaced `$data` brings its own
 * copy, so there is no swap to watch, and `DashboardScene.unlinkLibraryPanel` clears a panel's
 * `$behaviors` wholesale to drop one of them.
 */
export class PanelPluginTransformationsBehaviour extends SceneObjectBase<SceneObjectState> {
  public constructor(state: SceneObjectState = {}) {
    super(state);

    this.addActivationHandler(() => this._activationHandler());
  }

  /**
   * One instance, not a closure per activation: the transformer re-runs its pipeline whenever the
   * supplier reference changes, so rebuilding this would re-transform on every re-activation.
   */
  private _supplier: SystemTransformationsSupplier = ({ series }) => {
    // `SystemTransformationsSupplier` promises the plugin a data update carrying frames. The pipeline
    // resolves on every pass, including empty ones, so the promise is kept here.
    if (series.length === 0) {
      return {};
    }

    const plugin = this._plugin();

    if (!plugin) {
      return {};
    }

    const { prepend, append } = plugin.getSystemTransformations({ series });

    // The contract supports the series topic only. Scenes routes each entry by its own `topic`, so
    // without this a config aimed at annotations would quietly start transforming that stream.
    return { prepend: prepend.filter(appliesToSeriesTopic), append: append.filter(appliesToSeriesTopic) };
  };

  private _activationHandler() {
    // Gated here rather than inside the supplier so nothing is registered while the feature is off,
    // leaving the transformer's passthrough untouched for every panel. Flipping it needs a reload.
    if (!pluginTransformationsEnabled()) {
      return;
    }

    const transformer = this.parent;
    const panel = transformer?.parent;

    if (!(transformer instanceof SceneDataTransformer) || !(panel instanceof VizPanel)) {
      return;
    }

    transformer.setSystemTransformations({ origin: 'plugin', supplier: this._supplier });

    // Two things change what the supplier resolves without producing new data to resolve against:
    // switching visualization, and the panel finishing a plugin load that had not resolved yet. The
    // second cannot be seen from `pluginId` -- `_pluginLoaded` writes the value already in state --
    // so watch the plugin itself.
    let loadedPlugin = getLoadedPluginFor(panel);

    this._subs.add(
      panel.subscribeToState((newState, prevState) => {
        const nextPlugin = getLoadedPluginFor(panel);

        if (newState.pluginId === prevState.pluginId && nextPlugin === loadedPlugin) {
          return;
        }

        loadedPlugin = nextPlugin;
        transformer.reprocessTransformations();
      })
    );

    this._loadPluginIfUnresolved(transformer, panel);
  }

  private _plugin(): PanelPlugin | undefined {
    const panel = this.parent?.parent;

    if (!(panel instanceof VizPanel)) {
      return undefined;
    }

    // A runtime panel plugin lives in a registry inside scenes, which only the panel can reach.
    return getLoadedPluginFor(panel) ?? syncGetPanelPlugin(panel.state.pluginId);
  }

  /**
   * Nothing resolves a plugin id synchronously the first time, and the panel may never load it — a
   * data provider can be active without its panel rendering, which is how the dashboard datasource
   * reads a panel that is scrolled out of view. Imported from here rather than from the supplier:
   * `importPanelPlugin` drops its cache entry on failure, so a supplier awaiting it would re-reject
   * on every pass. A later `pluginId` change needs no repeat, because a panel being edited is a panel
   * being rendered, and the subscription above catches the load.
   */
  private _loadPluginIfUnresolved(transformer: SceneDataTransformer, panel: VizPanel) {
    if (this._plugin()) {
      return;
    }

    const { pluginId } = panel.state;

    importPanelPlugin(pluginId)
      .then(() => {
        // The panel may have been swapped or the provider torn down while the chunk loaded.
        if (this.isActive && panel.state.pluginId === pluginId) {
          transformer.reprocessTransformations();
        }
      })
      // An id nothing can resolve leaves the panel on its untransformed data, the same outcome as a
      // plugin that registers nothing. Never error the panel's data over it.
      .catch(() => undefined);
  }
}

/**
 * Qualified by `pluginId` because a panel holds a plugin for a different id while it swaps — a
 * library panel is built on a placeholder. Reading it unqualified would let the placeholder answer
 * for the real plugin.
 */
function getLoadedPluginFor(panel: VizPanel): PanelPlugin | undefined {
  const plugin = panel.getPlugin();

  return plugin?.meta.id === panel.state.pluginId ? plugin : undefined;
}

function appliesToSeriesTopic(transformation: DataTransformerConfig | CustomTransformOperator): boolean {
  if (typeof transformation === 'function') {
    return true;
  }

  return transformation.topic == null || transformation.topic === DataTopic.Series;
}
