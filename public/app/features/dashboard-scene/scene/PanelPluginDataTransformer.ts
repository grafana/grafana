import { from, of, switchMap } from 'rxjs';

import { type CustomTransformOperator, type PanelPlugin, transformDataFrame } from '@grafana/data';
import { FlagKeys, getFeatureFlagClient } from '@grafana/runtime/internal';
import {
  type SceneDataProvider,
  SceneDataTransformer,
  type SceneDataTransformerState,
  type SceneObject,
  VizPanel,
} from '@grafana/scenes';
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
   * Resolves the panel plugin inside the pipeline rather than at construction time: scenes are
   * built before `VizPanel` activates and loads its plugin, so there is nothing to ask when this
   * object is created.
   */
  private _runPluginTransformations: CustomTransformOperator = (ctx) => (source) =>
    source.pipe(
      switchMap((frames) => {
        const pluginId = getAncestorVizPanel(this)?.state.pluginId;

        if (!pluginId || frames.length === 0) {
          return of(frames);
        }

        const loaded = syncGetPanelPlugin(pluginId);
        const plugin$ = loaded ? of(loaded) : from(importPanelPlugin(pluginId));

        return plugin$.pipe(
          switchMap((plugin: PanelPlugin) => {
            const configs = plugin.getDataTransformations({ series: frames });

            // Returning the input array unchanged keeps its identity, so VizPanel can skip
            // re-running field overrides for panels that register no transformations.
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
  }
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
