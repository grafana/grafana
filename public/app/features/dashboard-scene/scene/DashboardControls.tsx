import React from 'react';

import { SceneObjectState, SceneObject, SceneObjectBase, SceneComponentProps } from '@grafana/scenes';
import { Box, Stack } from '@grafana/ui';

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
  const { variableControls, linkControls, timeControls, hideTimeControls } = model.useState();

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
        {!hideTimeControls && timeControls.map((c) => <c.Component model={c} key={c.state.key} />)}
      </Stack>
    </Stack>
  );
}
