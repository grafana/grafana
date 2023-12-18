import React from 'react';

import { SceneObjectState, SceneObject, SceneObjectBase, SceneComponentProps } from '@grafana/scenes';
import { Box, Stack, ToolbarButton } from '@grafana/ui';

import { getDashboardSceneFor } from '../utils/utils';

import { DashboardLinksControls } from './DashboardLinksControls';

interface DashboardControlsState extends SceneObjectState {
  variableControls: SceneObject[];
  timeControls: SceneObject[];
  linkControls: DashboardLinksControls;
  hideTimeControls?: boolean;
}
export class DashboardControls extends SceneObjectBase<DashboardControlsState> {
  static Component = DashboardControlsRenderer;
}

function DashboardControlsRenderer({ model }: SceneComponentProps<DashboardControls>) {
  const dashboard = getDashboardSceneFor(model);
  const { variableControls, linkControls, timeControls, hideTimeControls } = model.useState();
  const { isEditing } = dashboard.useState();

  return (
    <Stack
      grow={1}
      direction={{
        md: 'row',
        xs: 'column',
      }}
    >
      <Stack grow={1} wrap={'wrap'}>
        {variableControls.map((c) => (
          <c.Component model={c} key={c.state.key} />
        ))}
        <Box grow={1} />
        <linkControls.Component model={linkControls} />
      </Stack>
      <Stack justifyContent={'flex-end'}>
        {isEditing && (
          <ToolbarButton variant="canvas" icon="cog" tooltip="Dashboard settings" onClick={dashboard.onOpenSettings} />
        )}
        {!hideTimeControls && timeControls.map((c) => <c.Component model={c} key={c.state.key} />)}
      </Stack>
    </Stack>
  );
}
