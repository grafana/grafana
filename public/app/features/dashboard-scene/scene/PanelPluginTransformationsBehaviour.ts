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
  /**
   * The plugin the pipeline last resolved against, kept across deactivation so a load that finished,
   * or a visualization that was switched, while this was inactive is still visible on the way back.
   * Boxed because "never activated" and "activated while nothing resolved" are different answers and
   * both have to be representable.
   */
  private _resolvedPlugin: { plugin: PanelPlugin | undefined } | undefined;

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

    const plugin = this._plugin();
    // Re-registering the same supplier reference is a no-op to the transformer, so it won't
    // reprocess on its own — a plugin resolved while inactive only reaches the pipeline via the
    // reprocess call below. Skipped on a first activation: registering the supplier at all is
    // already the change.
    const resolvedWhileInactive = this._resolvedPlugin !== undefined && this._resolvedPlugin.plugin !== plugin;

    this._resolvedPlugin = { plugin };

    if (resolvedWhileInactive) {
      transformer.reprocessTransformations();
    }

    // Two things change what the supplier resolves without new data arriving: a visualization
    // switch, and a plugin finishing its load. The load doesn't touch `pluginId` — `_pluginLoaded`
    // writes the value already there — so this watches what the supplier reads, not `pluginId` alone.
    this._subs.add(
      panel.subscribeToState(() => {
        const nextPlugin = this._plugin();

        if (nextPlugin === this._resolvedPlugin?.plugin) {
          return;
        }

        this._resolvedPlugin = { plugin: nextPlugin };
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
   * A data provider can stay active without its panel rendering — the dashboard datasource reads
   * panels scrolled out of view this way — so nothing else may load the plugin. Called from here,
   * not the supplier, since a failed import is evicted from `importPanelPlugin`'s cache and would
   * re-reject every pass if awaited there. A later `pluginId` change needs no repeat: an edited
   * panel is a rendered one, and the subscription above already catches the load.
   */
  private _loadPluginIfUnresolved(transformer: SceneDataTransformer, panel: VizPanel) {
    if (this._plugin()) {
      return;
    }

    const { pluginId } = panel.state;

    importPanelPlugin(pluginId)
      // An id nothing can resolve leaves the panel on its untransformed data, the same outcome as a
      // plugin that registers nothing. Never error the panel's data over it. Before the handler
      // rather than after, so it cannot also swallow a failure to reprocess -- that one is a panel
      // silently serving the wrong frames, which should surface rather than be tolerated.
      .catch(() => undefined)
      .then(() => {
        // The panel may have been swapped or the provider torn down while the chunk loaded. Nothing
        // is lost in the second case: the next activation compares against what it last resolved and
        // picks the load up there.
        if (!this.isActive || panel.state.pluginId !== pluginId) {
          return;
        }

        const plugin = this._plugin();

        // The panel's own load of the same chunk reprocesses through the subscription above, so
        // whichever of the two lands second would otherwise force a redundant pass — re-running every
        // transformation and emitting a new `PanelData` for nothing. Also skips an id that resolved
        // nowhere: before and after both agree on `undefined`.
        if (plugin === this._resolvedPlugin?.plugin) {
          return;
        }

        this._resolvedPlugin = { plugin };
        transformer.reprocessTransformations();
      });
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
