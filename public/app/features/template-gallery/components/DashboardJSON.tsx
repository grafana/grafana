import { css, cx } from '@emotion/css';
import React, { useEffect, useState } from 'react';

import { GrafanaTheme2, urlUtil } from '@grafana/data';
import { SceneObjectStateChangedEvent, sceneUtils } from '@grafana/scenes';
import { Spinner, Alert, useStyles2 } from '@grafana/ui';
import { getDashboardScenePageStateManager } from 'app/features/dashboard-scene/pages/DashboardScenePageStateManager';
import { DashboardScene } from 'app/features/dashboard-scene/scene/DashboardScene';
import { transformSaveModelToScene } from 'app/features/dashboard-scene/serialization/transformSaveModelToScene';
import { DashboardDataDTO, DashboardRoutes } from 'app/types';

export interface DashboardJSONProps {
  schema: DashboardDataDTO;
  /**
   * Use this property to override initial time and variable state.
   * Example: ?from=now-5m&to=now&var-varname=value1
   */
  initialState?: string;
  /**
   * Is called when ever the internal embedded dashboards url state changes.
   * Can be used to sync the internal url state (Which is not synced to URL) with the external context, or to
   * preserve some of the state when moving to other embedded dashboards.
   */
  onStateChange?: (state: string) => void;
}

export function DashboardJSON(props: DashboardJSONProps) {
  const dashboard = transformSaveModelToScene({ dashboard: props.schema, meta: {} });

  return <DashboardJSONRenderer model={dashboard} {...props} />;
}

interface RendererProps extends DashboardJSONProps {
  model: DashboardScene;
}

function DashboardJSONRenderer({ model, initialState, onStateChange }: RendererProps) {
  const [isActive, setIsActive] = useState(false);
  const { controls, body, scopes } = model.useState();
  const styles = useStyles2(getStyles);

  useEffect(() => {
    setIsActive(true);

    if (initialState) {
      const searchParms = new URLSearchParams(initialState);
      sceneUtils.syncStateFromSearchParams(model, searchParms);
    }

    return model.activate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model]);

  useSubscribeToEmbeddedUrlState(onStateChange, model);

  if (!isActive) {
    return null;
  }

  return (
    <div
      className={cx(styles.canvas, controls && !scopes && styles.canvasWithControls, scopes && styles.canvasWithScopes)}
    >
      {scopes && <scopes.Component model={scopes} />}
      {controls && (
        <div className={cx(styles.controlsWrapper, scopes && styles.controlsWrapperWithScopes)}>
          <controls.Component model={controls} />
        </div>
      )}
      <div className={styles.body}>
        <body.Component model={body} />
      </div>
    </div>
  );
}

function useSubscribeToEmbeddedUrlState(onStateChange: ((state: string) => void) | undefined, model: DashboardScene) {
  useEffect(() => {
    if (!onStateChange) {
      return;
    }

    let lastState = '';
    const sub = model.subscribeToEvent(SceneObjectStateChangedEvent, (evt) => {
      if (evt.payload.changedObject.urlSync) {
        const state = sceneUtils.getUrlState(model);
        const stateAsString = urlUtil.renderUrl('', state);

        if (lastState !== stateAsString) {
          lastState = stateAsString;
          onStateChange(stateAsString);
        }
      }
    });

    return () => sub.unsubscribe();
  }, [model, onStateChange]);
}

function getStyles(theme: GrafanaTheme2) {
  return {
    canvas: css({
      label: 'canvas-content',
      display: 'grid',
      gridTemplateAreas: `
        "panels"`,
      gridTemplateColumns: `1fr`,
      gridTemplateRows: '1fr',
      flexBasis: '100%',
      flexGrow: 1,
    }),
    canvasWithControls: css({
      gridTemplateAreas: `
        "controls"
        "panels"`,
      gridTemplateRows: 'auto 1fr',
    }),
    canvasWithScopes: css({
      gridTemplateAreas: `
        "scopes controls"
        "panels panels"`,
      gridTemplateColumns: `${theme.spacing(32)} 1fr`,
      gridTemplateRows: 'auto 1fr',
    }),
    body: css({
      height: '100%',
      label: 'body',
      flexGrow: 1,
      display: 'flex',
      gap: '8px',
      gridArea: 'panels',
      marginBottom: theme.spacing(2),
    }),
    controlsWrapper: css({
      display: 'flex',
      flexDirection: 'column',
      flexGrow: 0,
      gridArea: 'controls',
      padding: theme.spacing(2, 0, 2, 2),
    }),
    controlsWrapperWithScopes: css({
      padding: theme.spacing(2, 0),
    }),
  };
}
