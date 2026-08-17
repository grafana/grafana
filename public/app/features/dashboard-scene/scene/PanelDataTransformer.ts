import { catchError, from, of, switchMap } from 'rxjs';

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

    // Gating installation keeps the base class's identity-preserving fast path for everyone the
    // feature is off for. The operator re-reads the flag on every emission, so this check only
    // decides whether the operator exists — never whether it applies.
    if (!pluginTransformationsEnabled()) {
      return;
    }

    // Installed from the constructor rather than from an activation handler or a behaviour: the
    // base class transforms whatever the source already holds as soon as it activates, and
    // `$behaviors` activate after `$data`, so anything later renders a frame of unprepared data on
    // every re-activation — entering and leaving panel edit, duplicating a panel, repeat rebuilds.
    this.setState({ systemTransformations: { prepend: [this._runPluginTransformations] } });

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
        // Re-read rather than reuse the constructor's result: flag values change over a session, so
        // caching one would leave the toggle unable to stop a panel it already applies to.
        if (!pluginTransformationsEnabled()) {
          return of(frames);
        }

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
    // source-panel path, tests) reach the data chain directly. Only ids no synchronous layer can
    // resolve need this — for the rest the operator already resolves on its first emission, and
    // reprocessing on plugin arrival would just repeat the same transform.
    if (!panel.getPlugin() && !syncGetPanelPlugin(panel.state.pluginId)) {
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

function pluginTransformationsEnabled(): boolean {
  return getFeatureFlagClient().getBooleanValue(FlagKeys.GrafanaPanelPluginTransformations, false);
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
