import { css } from '@emotion/css';
import { useEffect } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { SceneComponentProps, SceneObjectBase, SceneObject, SceneObjectState } from '@grafana/scenes';
import { Drawer, ToolbarButton, useStyles2 } from '@grafana/ui';
import appEvents from 'app/core/app_events';
import { AddonBarPane } from 'app/core/components/AppChrome/AddonBar/AddonBarPane';
import { useGrafana } from 'app/core/context/GrafanaContext';
import { ShowModalReactEvent } from 'app/types/events';

export type SceneDrawerProps = {
  scene: SceneObject;
  title: string;
  onDismiss: () => void;
};

export function SceneDrawer(props: SceneDrawerProps) {
  const { scene, title, onDismiss } = props;
  const styles = useStyles2(getStyles);
  const { chrome } = useGrafana();

  const onMinimize = () => {
    chrome.update({ addonBarPane: undefined });
  };

  const actions = (
    <>
      <ToolbarButton icon="minus-circle" onClick={onMinimize} />
      <ToolbarButton icon="times" onClick={onDismiss} />
    </>
  );

  return (
    <AddonBarPane title={'Explore metrics'} isApp={true} actions={actions}>
      <div className={styles.drawerInnerWrapper}>
        <scene.Component model={scene} />
      </div>
    </AddonBarPane>
  );
}

interface SceneDrawerAsSceneState extends SceneObjectState, SceneDrawerProps {}

export class SceneDrawerAsScene extends SceneObjectBase<SceneDrawerAsSceneState> {
  constructor(state: SceneDrawerProps) {
    super(state);
  }

  static Component({ model }: SceneComponentProps<SceneDrawerAsScene>) {
    const state = model.useState();
    const { chrome } = useGrafana();

    useEffect(() => {
      chrome.addAddonApp({
        id: 'scene-drawer',
        title: 'Explore metrics',
        icon: 'compass',
        isApp: true,
        props: state,
        //@ts-ignore
        component: SceneDrawer,
      });

      const removeAddonApp = () => chrome.removeAddonApp('scene-drawer');

      chrome.update({
        addonBarPane: {
          id: 'scene-drawer',
          isApp: true,
          content: <SceneDrawer {...state} onDismiss={removeAddonApp} />,
        },
      });

      return removeAddonApp;
    }, [chrome, state]);

    return null;
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
      marginTop: theme.spacing(-2),
    }),
  };
}
