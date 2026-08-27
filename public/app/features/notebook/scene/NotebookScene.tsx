import { css } from '@emotion/css';

import { CoreApp, type DataQueryRequest, type GrafanaTheme2 } from '@grafana/data';
import { config, useChromeHeaderHeight } from '@grafana/runtime';
import { useFlagGrafanaVisualDesignRefresh } from '@grafana/runtime/internal';
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
import { createMutationClient } from 'app/features/dashboard-scene/mutation-api/clientBridge';
import { getClosestVizPanel, getPanelIdForVizPanel } from 'app/features/dashboard-scene/utils/utils';

import { canEditNotebooks } from '../permissions';

import { NotebookAutosave } from './NotebookAutosave';
import { NotebookEditHistory } from './NotebookEditHistory';
import { NotebookEditHistoryControls } from './NotebookEditHistoryControls';
import { NotebookEditToggle } from './NotebookEditToggle';
import { NotebookSaveStatus } from './NotebookSaveStatus';
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
  public readonly editHistory = new NotebookEditHistory();
  // The layout manager needs to find the scene it lives in. It cannot use instanceof, because
  // importing this class would make the two files import each other, so it looks for this field.
  public readonly isNotebookScene = true;
  public readonly autosave = new NotebookAutosave(this);

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
      const syncRefreshPickerActivation = (state: NotebookSceneState) => {
        refreshPickerDeactivation?.();
        refreshPickerDeactivation = state.hideTimeControls ? state.refreshPicker.activate() : undefined;
      };
      syncRefreshPickerActivation(this.state);

      // Re-run it whenever the picker itself is replaced: a whole-state swap (APPLY_NOTEBOOK_SPEC
      // rebuilds the scene from a spec) hands us a new SceneRefreshPicker that nothing has activated,
      // so a one-shot activation above would leave auto-refresh silently stopped after an edit.
      const stateSub = this.subscribeToState((newState, prevState) => {
        if (
          newState.refreshPicker !== prevState.refreshPicker ||
          newState.hideTimeControls !== prevState.hideTimeControls
        ) {
          syncRefreshPickerActivation(newState);
        }
        // Edit mode is held in two places: here, where the header reads it, and on the layout manager,
        // where the cells do. `setState` MERGES, so a whole-state swap keeps this scene's `isEditing`
        // while replacing `body` with a rebuilt one that has no edit state, and the header would keep
        // saying Editing over cells that had gone read-only. Pushing it down on every change to either
        // makes the swap safe by construction. onEnterEditMode/onExitEditMode still push it themselves,
        // so the mode also propagates before this scene is activated.
        if (newState.body !== prevState.body || newState.isEditing !== prevState.isEditing) {
          newState.body.editModeChanged?.(Boolean(newState.isEditing));
        }
        // `tags` is mirrored for the same reason and kept true the same way: this scene is what the
        // save model reads, the layout manager is what the header renders. Pushing from here rather
        // than from onTagsChange means an APPLY_NOTEBOOK_SPEC swap reaches the header too.
        if (newState.body !== prevState.body || newState.tags !== prevState.tags) {
          newState.body.setTags?.(newState.tags);
        }
        // Every undo step puts a cell back into the body that recorded it. That body is gone now, so
        // the steps cannot run any more.
        if (newState.body !== prevState.body) {
          this.editHistory.clear();
        }
      });

      const destroyMutationClient = createMutationClient(this, 'notebook');
      const stopAutosave = this.autosave.start();

      return () => {
        stopAutosave();
        destroyMutationClient();
        stateSub.unsubscribe();
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

    // Before the state change, because entering edit mode is itself a state change and autosave decides
    // what to write the moment it sees one.
    this.autosave.notifyEditingStarted();
    this.setState({ isEditing: true });
    // Same channel DashboardScene uses to tell its layout the mode changed.
    this.state.body.editModeChanged?.(true);
  };

  public onExitEditMode = () => {
    this.state.body.commitPendingEdits();
    this.setState({ isEditing: false });
    this.state.body.editModeChanged?.(false);
    // Leaving edit mode is a natural save point, and it is where changes stop counting. Without this, a
    // save still waiting on the debounce would sit there until the page unmounts.
    this.autosave.flush();
  };

  /**
   * The scene stays the single writer for tags — it is what transformNotebookSceneToSaveModel reads.
   * The layout manager's copy is refreshed by the subscription above, so the two cannot drift.
   */
  public onTagsChange = (tags: string[]) => {
    this.setState({ tags });
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
  // The app header is fixed and its height varies (single vs docked mega menu), so the sticky offset has
  // to come from the chrome rather than a constant.
  const headerHeight = useChromeHeaderHeight();
  const visualRefreshEnabled = useFlagGrafanaVisualDesignRefresh();
  const styles = useStyles2(getStyles, headerHeight ?? 0, visualRefreshEnabled);
  const { body, timePicker, refreshPicker, hideTimeControls, overlay, isEditing } = model.useState();

  return (
    <div className={styles.container}>
      <NotebookHiddenVariables model={model} />
      <div className={styles.controls}>
        {/* Not gated on edit mode: the assistant writes without entering it, and a failed save has to
            be visible and retryable there too. This renders nothing until there is something to say. */}
        <NotebookSaveStatus autosave={model.autosave} />
        {isEditing && <NotebookEditHistoryControls history={model.editHistory} />}
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
    </div>
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

const getStyles = (theme: GrafanaTheme2, headerHeight: number, visualRefreshEnabled: boolean) => ({
  container: css({
    display: 'flex',
    flexDirection: 'column',
    flexGrow: 1,
  }),
  controls: css({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: theme.spacing(1),
    padding: theme.spacing(1, 2),
    // A sticky row is transparent by default, so the notebook would scroll visibly through it. These two
    // tokens are the page's own background (PageLayoutType.Custom, see getDefaultBackgroundForLayout), so
    // the row reads as chrome rather than as a tinted band — same pairing DashboardControlsChrome uses.
    background: visualRefreshEnabled ? theme.colors.background.page : theme.colors.background.canvas,
    // Only from md up: on a narrow viewport the row is a large share of the screen, so the dashboard lets
    // it scroll away rather than eat the reading area, and this follows suit.
    [theme.breakpoints.up('md')]: {
      position: 'sticky',
      top: headerHeight,
      // Above the docked sidebar, or the time picker's popover opens behind it. Same reasoning and same
      // token the dashboard's controls chrome uses.
      zIndex: theme.zIndex.sidemenu,
    },
  }),
});
