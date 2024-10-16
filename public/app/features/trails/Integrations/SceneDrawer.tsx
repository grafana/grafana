import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
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
