import { css } from '@emotion/css';

import { CoreApp, type DataQueryRequest, type GrafanaTheme2 } from '@grafana/data';
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
      app: CoreApp.Unknown,
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

function NotebookSceneRenderer({ model }: SceneComponentProps<NotebookScene>) {
  const styles = useStyles2(getStyles);
  const { body, timePicker, refreshPicker, hideTimeControls, overlay } = model.useState();

  return (
    <>
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

const getStyles = (theme: GrafanaTheme2) => ({
  controls: css({
    display: 'flex',
    justifyContent: 'flex-end',
    gap: theme.spacing(1),
    padding: theme.spacing(1, 2),
  }),
});
