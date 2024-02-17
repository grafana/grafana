import React, { ReactElement } from 'react';

import { SceneObjectState, SceneObjectBase, SceneObject } from '@grafana/scenes';
import { Box, Stack } from '@grafana/ui';

interface PanelControlsState extends SceneObjectState {
  otherControls: ReactElement[];
  timeControls: SceneObject[];
}

export class PanelControls extends SceneObjectBase<PanelControlsState> {
  static Component = PanelControlsRenderer;
}

function PanelControlsRenderer({ model }: { model: PanelControls }) {
  const { otherControls, timeControls } = model.useState();

  return (
    <Stack
      grow={1}
      direction={{
        md: 'row',
        xs: 'column',
      }}
    >
      <Box grow={1} />
      {otherControls.map((control, index) => React.cloneElement(control, { key: index }))}
      {timeControls.map((c) => (
        <c.Component model={c} key={c.state.key} />
      ))}
    </Stack>
  );
}
