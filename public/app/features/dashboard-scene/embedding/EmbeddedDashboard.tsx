import { css } from '@emotion/css';
import React, { useEffect, useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { EmbeddedDashboardProps } from '@grafana/runtime';
import { Spinner, Alert, useStyles2 } from '@grafana/ui';

import { getDashboardScenePageStateManager } from '../pages/DashboardScenePageStateManager';
import { DashboardScene } from '../scene/DashboardScene';

export function EmbeddedDashboard(props: EmbeddedDashboardProps) {
  const stateManager = getDashboardScenePageStateManager();
  const { dashboard, loadError } = stateManager.useState();

  useEffect(() => {
    stateManager.loadDashboard({ uid: props.uid!, isEmbedded: true });
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

function EmbeddedDashboardRenderer({ model, uid }: RendererProps) {
  const [isActive, setIsActive] = useState(false);
  const { controls, body } = model.useState();
  const styles = useStyles2(getStyles);

  useEffect(() => {
    setIsActive(true);
    return model.activate();
  }, [model]);

  if (!isActive) {
    return null;
  }

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
}

function getStyles(theme: GrafanaTheme2) {
  return {
    canvas: css({
      label: 'canvas-content',
      display: 'flex',
      flexDirection: 'column',
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
      top: 0,
      zIndex: theme.zIndex.navbarFixed,
      padding: theme.spacing(0, 0, 2, 0),
    }),
  };
}
