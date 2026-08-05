import { css } from '@emotion/css';

import { CoreApp, type DataQueryRequest, type GrafanaTheme2 } from '@grafana/data';
import {
  behaviors,
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
  /** Slot for notebook-owned drawers and modals; nothing renders here in the read-only POC. */
  overlay?: SceneObject;
  /** Always present — required for the time pickers and panel queries. Narrowed from the base's optional. */
  $timeRange: SceneTimeRange;
}

/**
 * The notebook scene root, composed from @grafana/scenes primitives — deliberately NOT a
 * DashboardScene (team decision, Notebook × Assistant 2026-08-05, point 1). A notebook shares the
 * dashboard's rendering stack (VizPanel, query runners, time propagation, cursor sync) but none of
 * its product surface: no edit-mode transaction, no save drawer, no dashboard panel menu, no
 * dashboard URL keys, and none of the dashboard tracking (a notebook open must not emit
 * dashboard-view analytics or start a dashboard-edit journey).
 *
 * Time range and refresh sync to the URL through SceneTimeRange (`from`/`to`/`timezone`) and
 * SceneRefreshPicker (`refresh`) themselves — no scene-level URL sync handler is needed, and no
 * dashboard chrome keys (`editPanel`, `editview`, `shareView`, `inspect`) exist at all.
 */
export class NotebookScene extends SceneObjectBase<NotebookSceneState> implements DataRequestEnricher {
  public static Component = NotebookSceneRenderer;

  public constructor(state: NotebookSceneState) {
    super({
      ...state,
      $behaviors: [
        // Shared crosshair across the notebook's panels. The notebook spec has no cursorSync
        // field yet, so this is a fixed default rather than a persisted preference.
        new behaviors.CursorSync({ sync: DashboardCursorSync.Crosshair }),
        // Coordinated query cancellation across all panels in the document.
        new behaviors.SceneQueryController(),
        ...(state.$behaviors ?? []),
      ],
    });

    this.addActivationHandler(() => {
      // template_srv and TimeSrv resolve variables/time for panel plugins through the global
      // scene context; without this, plugin-side interpolation silently degrades.
      const prevSceneContext = window.__grafanaSceneContext;
      window.__grafanaSceneContext = this;

      return () => {
        window.__grafanaSceneContext = prevSceneContext;
      };
    });
  }

  /**
   * Stamps every query fired from this scene. Deliberately no `dashboardUID`: notebook queries
   * must not be attributed to dashboards in datasource analytics/usage insights. A dedicated
   * CoreApp.Notebook needs a @grafana/data change — follow-up.
   */
  public enrichDataRequest(): Partial<DataQueryRequest> {
    return {
      app: CoreApp.Unknown,
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
