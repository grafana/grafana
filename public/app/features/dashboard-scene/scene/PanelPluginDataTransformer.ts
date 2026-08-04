import { catchError, from, of, switchMap } from 'rxjs';

import {
  type CustomTransformOperator,
  type DataTransformerConfig,
  type PanelPlugin,
  transformDataFrame,
} from '@grafana/data';
import { FlagKeys, getFeatureFlagClient } from '@grafana/runtime/internal';
import {
  type SceneDataProvider,
  SceneDataTransformer,
  type SceneDataTransformerState,
  type SceneObject,
  VizPanel,
} from '@grafana/scenes';
import { DataTopic } from '@grafana/schema';
import { importPanelPlugin, syncGetPanelPlugin } from 'app/features/plugins/importPanelPlugin';

/**
 * Runs the transformations a panel plugin registered via `PanelPlugin.setDataTransformations`.
 *
 * Sits between the query runner and the panel's user transformer, so plugin transformations
 * always run first and the fields they produce exist by the time `VizPanel.applyFieldConfig`
 * runs field overrides:
 *
 *     SceneQueryRunner -> PanelPluginDataTransformer -> SceneDataTransformer (user) -> VizPanel
 *
 * Keeping them in a separate provider is what makes them non-editable: the user transformer's
 * `transformations` state stays exactly as it is serialized, so no editor or serializer can
 * see, reorder, or persist them.
 */
export class PanelPluginDataTransformer extends SceneDataTransformer {
  public constructor(state: SceneDataTransformerState) {
    // The operator is stable for the lifetime of this object, so it replaces whatever
    // `transformations` was passed in (a clone carries the source object's operator, which is
    // bound to the source object rather than to this one).
    super({ ...state, transformations: [] });
    this.setState({ transformations: [this._runPluginTransformations] });

    this.addActivationHandler(() => this._activationHandler());
  }

  /**
   * Resolves the plugin inside the pipeline rather than at construction time: scenes are
   * built before `VizPanel` activates and loads its plugin, so there is nothing to ask when
   * this object is created.
   *
   * The panel's own plugin is preferred — scenes resolves it through Grafana's cache AND its
   * runtime-plugin registry, so ids like the unconfigured panel's are found here despite being
   * invisible to `importPanelPlugin`. The awaited import remains as a fallback for plugins the
   * panel has not loaded yet. An id that no layer resolves passes the frames through untouched
   * and is retried when the panel's plugin lands (see the activation handler): resolution
   * failure must never error the panel's data.
   */
  private _runPluginTransformations: CustomTransformOperator = (ctx) => (source) =>
    source.pipe(
      switchMap((frames) => {
        const panel = getAncestorVizPanel(this);

        if (!panel || frames.length === 0) {
          return of(frames);
        }

        const loaded = panel.getPlugin() ?? syncGetPanelPlugin(panel.state.pluginId);
        const plugin$ = loaded
          ? of(loaded)
          : from(importPanelPlugin(panel.state.pluginId)).pipe(catchError(() => of(undefined)));

        return plugin$.pipe(
          switchMap((plugin: PanelPlugin | undefined) => {
            if (!plugin) {
              return of(frames);
            }

            const configs = plugin.getDataTransformations({ series: frames }).filter(appliesToSeriesTopic);

            // Passing the input frames through untouched preserves their identity: the base
            // class rebuilds the series array either way, but structurally identical frames
            // keep the panel's structureRev stable, so panels that register no transformations
            // avoid needless re-configuration.
            return configs.length ? transformDataFrame(configs, frames, ctx) : of(frames);
          })
        );
      })
    );

  private _activationHandler() {
    const panel = getAncestorVizPanel(this);

    if (!panel) {
      return;
    }

    // The supplier can return different transformations per plugin, and switching visualization
    // does not produce new data, so nothing else would re-run the pipeline.
    this._subs.add(
      panel.subscribeToState((newState, prevState) => {
        if (newState.pluginId !== prevState.pluginId) {
          this.reprocessTransformations();
        }
      })
    );

    // Data can be processed before the panel loads its plugin: the panel's own activation loads
    // the plugin before activating `$data`, but other activators (the dashboard datasource's
    // source-panel path, tests) reach the data chain directly. Re-run once the plugin lands —
    // `VizPanel._pluginLoaded` always ends in a `setState`, so panel state is a reliable signal.
    if (!panel.getPlugin()) {
      const pluginLoadSub = panel.subscribeToState(() => {
        if (panel.getPlugin()) {
          pluginLoadSub.unsubscribe();
          this.reprocessTransformations();
        }
      });
      this._subs.add(pluginLoadSub);
    }
  }
}

/**
 * The base class splits transformations by topic above the plugin operator, so only series
 * frames ever reach it. A config targeting another topic can never see the frames it was
 * written for — it would be misapplied to series data — so it is dropped instead.
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

/**
 * Wraps a panel's query runner so the panel plugin's own transformations run before the user's.
 *
 * Evaluated per scene build rather than per render: the provider chain is structural, so
 * flipping the flag mid-session takes effect on the next dashboard load.
 */
export function wrapInPanelPluginDataTransformer($data: SceneDataProvider): SceneDataProvider {
  if (!getFeatureFlagClient().getBooleanValue(FlagKeys.GrafanaPanelPluginTransformations, false)) {
    return $data;
  }

  return new PanelPluginDataTransformer({ $data, transformations: [] });
}
