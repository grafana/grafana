import React from 'react';

import { SceneComponentProps, SceneObjectBase, SceneObjectRef, SceneObjectState, VizPanel } from '@grafana/scenes';

import { DashboardScene } from '../../scene/DashboardScene';

import ShareButton from './ShareButton';

export interface ShareButtonState extends SceneObjectState, ShareOptions {
  panelRef?: SceneObjectRef<VizPanel>;
  dashboardRef: SceneObjectRef<DashboardScene>;
}

interface ShareOptions {
  isOpen: boolean;
}

export class ShareButton2 extends SceneObjectBase<ShareButtonState> {
  static Component = ShareButtonRenderer;

  constructor(state: Omit<ShareButtonState, keyof ShareOptions>) {
    super({
      ...state,
      isOpen: false,
    });
  }

  onOpenSwitch = () => {
    this.setState({ isOpen: !this.state.isOpen });
  };
}

function ShareButtonRenderer({ model }: SceneComponentProps<ShareButton2>) {
  const state = model.useState();
  const { dashboardRef } = state;

  return <ShareButton dashboard={dashboardRef.resolve()} />;
}
