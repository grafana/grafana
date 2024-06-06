import React, { ReactNode } from 'react';

import { SceneComponentProps, SceneObjectBase, SceneObjectRef, SceneObjectState, VizPanel } from '@grafana/scenes';
import { Drawer } from '@grafana/ui';

import { getDashboardSceneFor } from '../../utils/utils';
import { ModalSceneObjectLike } from '../types';

import { ShareDrawerContext } from './ShareDrawerContext';

export interface ShareDrawerState extends SceneObjectState {
  title: string;
  panelRef?: SceneObjectRef<VizPanel>;
  body: ReactNode;
}

export class ShareDrawer extends SceneObjectBase<ShareDrawerState> implements ModalSceneObjectLike {
  static Component = ShareDrawerRenderer;

  onDismiss = () => {
    const dashboard = getDashboardSceneFor(this);
    dashboard.closeModal();
  };
}

function ShareDrawerRenderer({ model }: SceneComponentProps<ShareDrawer>) {
  const { title, body } = model.useState();
  const dashboard = getDashboardSceneFor(model.getRef().resolve());

  return (
    <Drawer title={title} onClose={model.onDismiss} size="md">
      <ShareDrawerContext.Provider value={{ dashboard }}>{body}</ShareDrawerContext.Provider>
    </Drawer>
  );
}
