import { css } from '@emotion/css';

import { CoreApp, type DataQueryRequest, type GrafanaTheme2 } from '@grafana/data';
import { Trans } from '@grafana/i18n';
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
import { Text, useStyles2 } from '@grafana/ui';
import { getClosestVizPanel, getPanelIdForVizPanel } from 'app/features/dashboard-scene/utils/utils';

import { canEditNotebooks } from '../permissions';

import { NotebookEditToggle } from './NotebookEditToggle';
import { NotebookSceneUrlSync } from './NotebookSceneUrlSync';
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
  /**
   * Whether the notebook is being edited rather than read. Runtime only — nothing is saved yet, and
   * the cells gain no real editing UI beyond becoming writable.
   */
  isEditing?: boolean;
}

export class NotebookScene extends SceneObjectBase<NotebookSceneState> implements DataRequestEnricher {
  public static Component = NotebookSceneRenderer;

  // Edit mode is reflected in the url by this handler rather than by the methods below, so the url
  // stays a projection of the state instead of a second copy of it.
  protected _urlSync = new NotebookSceneUrlSync(this);

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

  /**
   * Permission is checked here rather than only where the toggle renders, so no caller — including
   * a hand-typed `?edit=true` — can force edit mode for a user without `dashboards:write`.
   */
  public onEnterEditMode = () => {
    if (!canEditNotebooks()) {
      return;
    }

    this.setState({ isEditing: true });
    // Same channel DashboardScene uses to tell its layout the mode changed.
    this.state.body.editModeChanged?.(true);
  };

  public onExitEditMode = () => {
    this.setState({ isEditing: false });
    this.state.body.editModeChanged?.(false);
  };

  public showModal(modal: SceneObject) {
    this.setState({ overlay: modal });
  }

  public closeModal() {
    this.setState({ overlay: undefined });
  }
}

/**
 * A notebook's only scene variable is the scopes one, and only when scopes are on.
 *
 * SceneQueryRunner reads scopes off the graph (sceneGraph.getScopes -> lookupVariable('__scopes')),
 * so a notebook without this variable runs its queries unscoped while the same panels on a
 * dashboard are scoped. The variable is also what enables the scope selector at all: its
 * setContext calls ScopesContext.setEnabled.
 *
 * No publicDashboardAccessToken guard, unlike the dashboard transform: that token is only set by
 * middleware on the /public-dashboards/:accessToken routes, which never render a notebook.
 */
function buildNotebookVariables(): SceneVariableSet | undefined {
  if (!config.featureToggles.scopeFilters) {
    return undefined;
  }

  return new SceneVariableSet({ variables: [new ScopesVariable({ enable: true })] });
}

function NotebookSceneRenderer({ model }: SceneComponentProps<NotebookScene>) {
  const styles = useStyles2(getStyles);
  const { body, timePicker, refreshPicker, hideTimeControls, overlay, isEditing } = model.useState();

  return (
    <>
      <NotebookHiddenVariables model={model} />
      {/* The row itself always renders: the edit toggle must not inherit the pickers' visibility.
          Only the pickers are conditional. */}
      <div className={styles.controls}>
        {isEditing && (
          // Pushed to the far left of the row; everything else stays right-aligned.
          <span className={styles.mode}>
            <Text variant="bodySmall" color="secondary">
              <Trans i18nKey="notebooks.view.editing">Editing</Trans>
            </Text>
          </span>
        )}
        <NotebookEditToggle notebook={model} />
        {!hideTimeControls && (
          <>
            <timePicker.Component model={timePicker} />
            <refreshPicker.Component model={refreshPicker} />
          </>
        )}
      </div>
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
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: theme.spacing(1),
    padding: theme.spacing(1, 2),
  }),
  mode: css({
    marginRight: 'auto',
  }),
});
