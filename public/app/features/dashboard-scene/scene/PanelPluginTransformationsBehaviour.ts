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
 * System transformation behavior (panel plugin defined transformation)
 * Runs `PanelPlugin.setSystemTransformations` by handing the transformer a supplier that resolves from the frames
 * entering the pipeline. Nothing it contributes reaches `state.transformations`.
 */
export class PanelPluginTransformationsBehaviour extends SceneObjectBase<SceneObjectState> {
  // The plugin the pipeline last resolved against
  private _resolvedPlugin: { plugin: PanelPlugin | undefined } | undefined;

  public constructor(state: SceneObjectState = {}) {
    super(state);

    this.addActivationHandler(() => this._activationHandler());
  }

  private _activationHandler() {
    // Gated here rather than inside the supplier so nothing is registered while the feature is off
    if (!pluginTransformationsEnabled()) {
      return;
    }

    const transformer = this.parent;
    const panel = transformer?.parent;

    if (!(transformer instanceof SceneDataTransformer) || !(panel instanceof VizPanel)) {
      return;
    }

    transformer.setSystemTransformations({ origin: 'plugin', supplier: this._supplier });

    const plugin = this._plugin();
    // Re-registering the same supplier reference is a no-op to the transformer
    const resolvedWhileInactive = this._resolvedPlugin !== undefined && this._resolvedPlugin.plugin !== plugin;

    this._resolvedPlugin = { plugin };

    if (resolvedWhileInactive) {
      transformer.reprocessTransformations();
    }

    this._subs.add(this._subscribeToPanel(panel, transformer));

    this._loadPluginIfUnresolved(transformer, panel);
  }
  /**
   * One instance, not a closure per activation: the transformer re-runs its pipeline whenever the
   * supplier reference changes, so rebuilding this would re-transform on every re-activation.
   */
  private _supplier: SystemTransformationsSupplier = ({ series }) => {
    // `SystemTransformationsSupplier` promises the plugin a data update carrying frames. The pipeline
    // resolves on every pass, including empty ones.
    if (series.length === 0) {
      return {};
    }

    const plugin = this._plugin();

    if (!plugin) {
      return {};
    }

    const { prepend, append } = plugin.getSystemTransformations({ series });

    // The contract supports the series topic only.
    return { prepend: prepend.filter(appliesToSeriesTopic), append: append.filter(appliesToSeriesTopic) };
  };

  /**
   * Set _resolvedPlugin on loading and panel changes
   */
  private _subscribeToPanel = (panel: VizPanel, transformer: SceneDataTransformer) => {
    return panel.subscribeToState(() => {
      const nextPlugin = this._plugin();

      if (nextPlugin === this._resolvedPlugin?.plugin) {
        return;
      }

      this._resolvedPlugin = { plugin: nextPlugin };
      transformer.reprocessTransformations();
    });
  };

  private _plugin(): PanelPlugin | undefined {
    const panel = this.parent?.parent;

    if (!(panel instanceof VizPanel)) {
      return undefined;
    }

    return getLoadedPluginFor(panel) ?? syncGetPanelPlugin(panel.state.pluginId);
  }

  /**
   * A data provider can stay active without its panel rendering (dashboard datasource + inactive panel).
   * Called from here, not the supplier, since a failed import is evicted from `importPanelPlugin`'s cache and would
   * re-reject every pass if awaited there. A later `pluginId` change needs no repeat: an edited
   * panel is a rendered one, and the _subscribeToPanel subscription above already catches the load.
   */
  private _loadPluginIfUnresolved(transformer: SceneDataTransformer, panel: VizPanel) {
    if (this._plugin()) {
      return;
    }

    const { pluginId } = panel.state;

    importPanelPlugin(pluginId)
      // Don't error the panel's data if pluginId is not resolved!
      .catch(() => undefined)
      .then(() => {
        // Don't reprocess if not active
        if (!this.isActive || panel.state.pluginId !== pluginId) {
          return;
        }

        const plugin = this._plugin();

        // Don't reprocess if plugin is already resolved
        if (plugin === this._resolvedPlugin?.plugin) {
          return;
        }

        this._resolvedPlugin = { plugin };
        transformer.reprocessTransformations();
      });
  }
}

/**
 * Qualified by `pluginId` because a panel holds a plugin for a different id while it swaps
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
