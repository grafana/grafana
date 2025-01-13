import { css } from '@emotion/css';
import { useEffect, useId } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { SceneComponentProps, SceneObjectBase, SceneObject, SceneObjectState } from '@grafana/scenes';
import { ToolbarButton, useStyles2 } from '@grafana/ui';
import appEvents from 'app/core/app_events';
import { AddonBarPane } from 'app/core/components/AppChrome/AddonBar/AddonBarPane';
import { useGrafana } from 'app/core/context/GrafanaContext';
import { ShowModalReactEvent } from 'app/types/events';

export type SceneDrawerProps = {
  scene: SceneObject;
  title: string;
  id: string;
};

export function SceneDrawer(props: SceneDrawerProps) {
  const { scene, id } = props;
  const styles = useStyles2(getStyles);
  const { chrome } = useGrafana();

  const onMinimize = () => {
    chrome.update({ addonBarPane: undefined });
  };

  const onClose = () => {
    chrome.removeAddonApp(id);
  };

  const actions = (
    <>
      <ToolbarButton icon="minus-circle" onClick={onMinimize} tooltip="Minimize" />
      <ToolbarButton icon="times" onClick={onClose} tooltip="Close" />
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
    const id = useId();

    useEffect(() => {
      chrome.addAddonApp({
        id: id,
        title: 'Explore metrics',
        icon: 'compass',
        isApp: true,
        props: { ...state, id: id },
        //@ts-ignore
        component: SceneDrawer,
      });

      chrome.update({
        addonBarPane: {
          id: id,
          isApp: true,
          content: <SceneDrawer {...state} />,
        },
      });
    }, [chrome, state, id]);

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
