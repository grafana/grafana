import React from 'react';

import { SceneComponentProps, SceneObjectBase, SceneObject, SceneObjectState } from '@grafana/scenes';
import { Drawer } from '@grafana/ui';
import appEvents from 'app/core/app_events';
import { ShowModalReactEvent } from 'app/types/events';

export type SceneDrawerProps = {
  scene: SceneObject;
  title: string;
  onClose: () => void;
};

export function SceneDrawer({ onClose, scene, title }: SceneDrawerProps) {
  return (
    <Drawer title={title} onClose={onClose} size="lg">
      <div style={{ display: 'flex', height: '100%' }}>
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

export function launchSceneDrawerInGlobalModal(props: Omit<SceneDrawerProps, 'onClose'>) {
  const allProps: SceneDrawerProps = {
    ...props,
    onClose: () => {
      const event = new ShowModalReactEvent({ component: () => null });
      appEvents.publish(event);
    },
  };

  const payload = {
    component: SceneDrawer,
    allProps,
  };

  appEvents.publish(new ShowModalReactEvent(payload));
}
