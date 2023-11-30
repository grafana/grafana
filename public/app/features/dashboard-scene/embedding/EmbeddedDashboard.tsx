import { css } from '@emotion/css';
import React, { useEffect, useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { EmbeddedDashboardProps } from '@grafana/runtime';
import { Spinner, Alert, useStyles2, Drawer, Box, TextLink, Button, Stack } from '@grafana/ui';

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

function EmbeddedDashboardRenderer({ model, uid, inDrawer, onClose = () => {} }: RendererProps) {
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

  if (!inDrawer) {
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

  const title = (
    <Stack direction="column" gap={0}>
      <div className={styles.drawerHeader}>
        <div className={styles.drawerTitle}>{model.state.title}</div>
        <div className={styles.actions}>
          <Button icon="times" variant="secondary" fill="text" onClick={onClose} />
        </div>
      </div>
      <Box paddingX={2}>
        <TextLink href={`/d/${uid}`}>Open dashboard</TextLink>
        {controls && (
          <div className={styles.controls}>
            {controls.map((control) => (
              <control.Component key={control.state.key} model={control} />
            ))}
          </div>
        )}
      </Box>
    </Stack>
  );

  return (
    <Drawer title={title} onClose={onClose} size="lg">
      <body.Component model={body} />
    </Drawer>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    drawerHeader: css({
      display: 'flex',
      padding: theme.spacing(2, 2, 0, 2),
    }),
    drawerTitle: css({
      fontSize: theme.typography.h4.fontSize,
      flexGrow: 1,
    }),
    actions: css({
      position: 'absolute',
      right: theme.spacing(1),
      top: theme.spacing(1),
    }),
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
