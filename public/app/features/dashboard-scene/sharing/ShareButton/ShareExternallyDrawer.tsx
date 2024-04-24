import React from 'react';

import { SceneComponentProps, SceneObjectBase, SceneObjectRef, SceneObjectState } from '@grafana/scenes';

import { DashboardScene } from '../../scene/DashboardScene';

export interface ShareExternallyDrawerState extends SceneObjectState {
  dashboardRef: SceneObjectRef<DashboardScene>;
}

export class ShareExternallyDrawer extends SceneObjectBase<ShareExternallyDrawerState> {
  static Component = ShareExternallyDrawerRenderer;

  constructor(state: ShareExternallyDrawerState) {
    super(state);
  }
}

function ShareExternallyDrawerRenderer({ model }: SceneComponentProps<ShareExternallyDrawer>) {
  return <h1>Content</h1>;
}
