import React from 'react';

import { SceneComponentProps, SceneObjectBase, SceneObjectState } from '@grafana/scenes';
import { ToolbarButton } from '@grafana/ui';

import { getDashboardSceneFor } from '../utils/utils';

interface DashboardEditControlsState extends SceneObjectState {}

export class DashboardEditControls extends SceneObjectBase<DashboardEditControlsState> {
  static Component = DashboardEditControlsRenderer;
}

function DashboardEditControlsRenderer({ model }: SceneComponentProps<DashboardEditControls>) {
  const dashboard = getDashboardSceneFor(model);
  const { isEditing } = dashboard.useState();

  if (!isEditing) {
    return null;
  }

  return <ToolbarButton variant="canvas" icon="cog" tooltip="Dashboard settings" onClick={dashboard.onOpenSettings} />;
}
