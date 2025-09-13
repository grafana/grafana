import { css, cx } from '@emotion/css';
import { useEffect, useState } from 'react';

import { GrafanaTheme2, urlUtil } from '@grafana/data';
import { EmbeddedDashboardProps } from '@grafana/runtime';
import { SceneObjectStateChangedEvent, sceneUtils } from '@grafana/scenes';
import { Spinner, Alert, useStyles2 } from '@grafana/ui';
import { DashboardRoutes } from 'app/types';

import { getDashboardScenePageStateManager } from '../pages/DashboardScenePageStateManager';
import { DashboardScene } from '../scene/DashboardScene';

export function EmbeddedDashboard(props: EmbeddedDashboardProps) {
  const stateManager = getDashboardScenePageStateManager();
  const { dashboard, loadError } = stateManager.useState();

  useEffect(() => {
    stateManager.loadDashboard({ uid: props.uid!, route: DashboardRoutes.Embedded });
    return () => {
      stateManager.clearState();
    };
  }, [stateManager, props.uid]);

  if (loadError) {
    return (
      <Alert severity="error" title="Failed to load dashboard">
        {loadError}
      </Alert>
    );
  }

  if (!dashboard) {
    return <Spinner />;
  }

  return <EmbeddedDashboardRenderer model={dashboard} {...props} />;
}

interface RendererProps extends EmbeddedDashboardProps {
  model: DashboardScene;
}

function EmbeddedDashboardRenderer({ model, initialState, onStateChange }: RendererProps) {
  const [isActive, setIsActive] = useState(false);
  const { controls, body } = model.useState();
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
    <div className={cx(styles.canvas, controls && styles.canvasWithControls)}>
      {controls && (
        <div className={styles.controlsWrapper}>
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
      label: 'canvas-content-embedded-dashboard',
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
    body: css({
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
  };
}
