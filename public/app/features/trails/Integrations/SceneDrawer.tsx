import { css } from '@emotion/css';
import React, { useEffect } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { locationService } from '@grafana/runtime';
import { SceneComponentProps, SceneObjectBase, SceneObject, SceneObjectState } from '@grafana/scenes';
import { Drawer, useStyles2 } from '@grafana/ui';
import appEvents from 'app/core/app_events';
import { ShowModalReactEvent } from 'app/types/events';

export type SceneDrawerProps = {
  scene: SceneObject;
  title: string;
  onDismiss: () => void;
};

export function SceneDrawer(props: SceneDrawerProps) {
  const { scene, title, onDismiss } = props;
  const styles = useStyles2(getStyles);

  useEffect(() => {
    // Adding this additional push prevents an embed in scenes dashboards from going back too far
    locationService.push(locationService.getLocation());

    const unregister = locationService.getHistory().listen((location, action) => {
      if (action === 'POP') {
        // Use the 'back' button to dismiss
        locationService.push(location); // Undo the effects of the back button, and push the location back
        onDismiss(); // Call the drawer modal's dismiss
      }
    });

    return unregister;
  }, [onDismiss]);

  return (
    <Drawer title={title} onClose={onDismiss} size="lg">
      <div className={styles.drawerInnerWrapper}>
        <scene.Component model={scene} />
      </div>
    </Drawer>
  );
}

interface SceneDrawerAsSceneState extends SceneObjectState, SceneDrawerProps {}

export class SceneDrawerAsScene extends SceneObjectBase<SceneDrawerAsSceneState> {
  constructor(state: SceneDrawerProps) {
    super(state);
  }

  static Component({ model }: SceneComponentProps<SceneDrawerAsScene>) {
    const state = model.useState();

    return <SceneDrawer {...state} />;
  }
}

export function launchSceneDrawerInGlobalModal(props: Omit<SceneDrawerProps, 'onDismiss'>) {
  const payload = {
    component: SceneDrawer,
    props,
  };

  appEvents.publish(new ShowModalReactEvent(payload));
}

function getStyles(theme: GrafanaTheme2) {
  return {
    drawerInnerWrapper: css({
      display: 'flex',
      padding: theme.spacing(2),
      background: theme.isDark ? theme.colors.background.canvas : theme.colors.background.primary,
      position: 'absolute',
      left: 0,
      right: 0,
      top: 0,
    }),
  };
}
