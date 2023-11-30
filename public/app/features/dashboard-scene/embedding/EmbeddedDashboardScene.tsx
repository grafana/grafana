import { css } from '@emotion/css';
import React from 'react';

import { CoreApp, DataQueryRequest, GrafanaTheme2 } from '@grafana/data';
import { SceneObject, SceneObjectBase, SceneObjectState, SceneComponentProps } from '@grafana/scenes';
import { DashboardLink } from '@grafana/schema';
import { useStyles2 } from '@grafana/ui';
import { DashboardMeta } from 'app/types';

import { getClosestVizPanel, getPanelIdForVizPanel } from '../utils/utils';

export interface EmbeddedDashboardSceneState extends SceneObjectState {
  /** The title */
  title: string;
  /** Tags */
  tags?: string[];
  /** Links */
  links?: DashboardLink[];
  /** A uid when saved */
  uid?: string;
  /** Layout of panels */
  body: SceneObject;
  /** Fixed row at the top of the canvas with for example variables and time range controls */
  controls?: SceneObject[];
  /** meta flags */
  meta: DashboardMeta;
}

export class EmbeddedDashboard extends SceneObjectBase<EmbeddedDashboardSceneState> {
  public constructor(state: EmbeddedDashboardSceneState) {
    super(state);

    this.addActivationHandler(() => this._activationHandler());
  }

  private _activationHandler() {
    const prevContext = window.__grafanaSceneContext;

    window.__grafanaSceneContext = this;

    // const oldDashboardWrapper = new DashboardModelCompatibilityWrapper(this);
    // getDashboardSrv().setCurrent(oldDashboardWrapper);

    // Deactivation logic
    return () => {
      window.__grafanaSceneContext = prevContext;
      //oldDashboardWrapper.destroy();
    };
  }

  /**
   * Called by the SceneQueryRunner to privide contextural parameters (tracking) props for the request
   */
  public enrichDataRequest(sceneObject: SceneObject): Partial<DataQueryRequest> {
    const panel = getClosestVizPanel(sceneObject);

    return {
      app: CoreApp.Dashboard,
      dashboardUID: this.state.uid,
      panelId: (panel && getPanelIdForVizPanel(panel)) ?? 0,
    };
  }

  public static Component = ({ model }: SceneComponentProps<EmbeddedDashboard>) => {
    const { controls, body } = model.useState();
    const styles = useStyles2(getStyles);

    return (
      <div className={styles.canvas}>
        {controls && (
          <div className={styles.controls}>
            {controls.map((control) => (
              <control.Component key={control.state.key} model={control} />
            ))}
          </div>
        )}
        <div className={styles.body}>
          <body.Component model={body} />
        </div>
      </div>
    );
  };
}

function getStyles(theme: GrafanaTheme2) {
  return {
    canvas: css({
      label: 'canvas-content',
      display: 'flex',
      flexDirection: 'column',
      padding: theme.spacing(0, 2),
      flexBasis: '100%',
      flexGrow: 1,
    }),
    body: css({
      label: 'body',
      flexGrow: 1,
      display: 'flex',
      gap: '8px',
      marginBottom: theme.spacing(2),
    }),

    controls: css({
      display: 'flex',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: theme.spacing(1),
      position: 'sticky',
      top: 0,
      background: theme.colors.background.canvas,
      zIndex: theme.zIndex.navbarFixed,
      padding: theme.spacing(2, 0),
    }),
  };
}
