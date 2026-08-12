import { css } from '@emotion/css';

import { CoreApp, type DataQueryRequest, type GrafanaTheme2 } from '@grafana/data';
import { config } from '@grafana/runtime';
import {
  behaviors,
  type CancelActivationHandler,
  type DataRequestEnricher,
  type SceneComponentProps,
  type SceneObject,
  SceneObjectBase,
  type SceneObjectState,
  type SceneRefreshPicker,
  type SceneTimePicker,
  type SceneTimeRange,
  SceneVariableSet,
  ScopesVariable,
} from '@grafana/scenes';
import { DashboardCursorSync } from '@grafana/schema';
import { useStyles2 } from '@grafana/ui';
import { getClosestVizPanel, getPanelIdForVizPanel } from 'app/features/dashboard-scene/utils/utils';

import { type NotebookLayoutManager } from './layout-notebook/NotebookLayoutManager';

export interface NotebookSceneState extends SceneObjectState {
  title: string;
  description?: string;
  tags?: string[];
  /** k8s metadata.name of the Notebook resource. */
  uid?: string;
  /** The vertical document of cells. */
  body: NotebookLayoutManager;
  timePicker: SceneTimePicker;
  refreshPicker: SceneRefreshPicker;
  hideTimeControls?: boolean;
  overlay?: SceneObject;
  $timeRange: SceneTimeRange;
}

export class NotebookScene extends SceneObjectBase<NotebookSceneState> implements DataRequestEnricher {
  public static Component = NotebookSceneRenderer;

  public constructor(state: NotebookSceneState) {
    super({
      ...state,
      // Composed in here rather than by the deserializer: scopes are runtime context, not part of
      // the notebook spec, so every NotebookScene needs them regardless of how it was built.
      $variables: state.$variables ?? buildNotebookVariables(),
      $behaviors: [
        new behaviors.CursorSync({ sync: DashboardCursorSync.Crosshair }),
        new behaviors.SceneQueryController(),
        ...(state.$behaviors ?? []),
      ],
    });

    this.addActivationHandler(() => {
      // template_srv and TimeSrv resolve variables/time for panel plugins through the global
      // scene context; without this, plugin-side interpolation silently degrades.
      const prevSceneContext = window.__grafanaSceneContext;
      window.__grafanaSceneContext = this;

      // activate() only propagates to $timeRange/$variables/$data/$behaviors — the pickers are
      // plain state, so they are activated by their renderers. With the controls row hidden nothing
      // renders the refresh picker, so activate it here or the spec's autoRefresh interval never
      // starts. Same workaround as DashboardControls.
      let refreshPickerDeactivation: CancelActivationHandler | undefined;
      if (this.state.hideTimeControls) {
        refreshPickerDeactivation = this.state.refreshPicker.activate();
      }

      return () => {
        refreshPickerDeactivation?.();
        window.__grafanaSceneContext = prevSceneContext;
      };
    });
  }

  public enrichDataRequest(source: SceneObject): Partial<DataQueryRequest> {
    const panel = getClosestVizPanel(source);

    return {
      // Not Unknown: that is indistinguishable from a genuinely unattributed query, and it would
      // also overwrite the 'scenes' SceneQueryRunner already sets. Not Dashboard either — that value
      // is a behavioural branch, not just a label (SqlDatasource skips its query-executed
      // interaction for it), and notebooks are not dashboards.
      app: CoreApp.Notebook,
      panelId: (panel && getPanelIdForVizPanel(panel)) ?? 0,
      panelName: panel?.state.title,
      panelPluginId: panel?.state.pluginId,
    };
  }

  public showModal(modal: SceneObject) {
    this.setState({ overlay: modal });
  }

  public closeModal() {
    this.setState({ overlay: undefined });
  }
}

/**
 * A notebook's only scene variable is the scopes one, and only when scopes are on. The same
 * condition as the dashboard v2 transform, including the public-dashboard opt-out.
 *
 * SceneQueryRunner reads scopes off the graph (sceneGraph.getScopes -> lookupVariable('__scopes')),
 * so a notebook without this variable runs its queries unscoped while the same panels on a
 * dashboard are scoped. The variable is also what enables the scope selector at all: its
 * setContext calls ScopesContext.setEnabled.
 */
function buildNotebookVariables(): SceneVariableSet | undefined {
  if (!config.featureToggles.scopeFilters || config.publicDashboardAccessToken) {
    return undefined;
  }

  return new SceneVariableSet({ variables: [new ScopesVariable({ enable: true })] });
}

function NotebookSceneRenderer({ model }: SceneComponentProps<NotebookScene>) {
  const styles = useStyles2(getStyles);
  const { body, timePicker, refreshPicker, hideTimeControls, overlay } = model.useState();

  return (
    <>
      <NotebookHiddenVariables model={model} />
      {!hideTimeControls && (
        <div className={styles.controls}>
          <timePicker.Component model={timePicker} />
          <refreshPicker.Component model={refreshPicker} />
        </div>
      )}
      <body.Component model={body} />
      {overlay && <overlay.Component model={overlay} />}
    </>
  );
}

/**
 * ScopesVariable is UNSAFE_renderAsHidden and reaches ScopesContext only through its own renderer,
 * so mounting it is mandatory, not cosmetic: it starts with `loading: true` and resolves
 * validateAndUpdate only once setContext sees the context. Left unmounted, every query runner
 * depending on it (SceneQueryRunner sets dependsOnScopes) waits forever and no panel loads.
 * Same reason SoloPanelPage renders its hidden variables.
 */
function NotebookHiddenVariables({ model }: SceneComponentProps<NotebookScene>) {
  const { $variables } = model.useState();

  if (!$variables) {
    return null;
  }

  return (
    <>
      {$variables.state.variables
        .filter((variable) => variable.UNSAFE_renderAsHidden)
        .map((variable) => (
          <variable.Component model={variable} key={variable.state.key} />
        ))}
    </>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  controls: css({
    display: 'flex',
    justifyContent: 'flex-end',
    gap: theme.spacing(1),
    padding: theme.spacing(1, 2),
  }),
});
