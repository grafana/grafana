import React, { CSSProperties } from 'react';

import { Stack } from '@grafana/experimental';

import { SceneComponentProps, SceneItemBase, SceneLayoutItemChildState } from './SceneItem';

export interface VizPanelState extends SceneLayoutItemChildState {
  title?: string;
}

export class VizPanel extends SceneItemBase<VizPanelState> {
  Component = ScenePanelRenderer;

  constructor(state: VizPanelState) {
    super(state);
  }
}

const ScenePanelRenderer = React.memo<SceneComponentProps<VizPanel>>(({ model }) => {
  const state = model.useState();
  const { timeRange } = model.getTimeRange()!.useState();

  // useEffect(() => {
  //   model.mounted();
  //   return model.unmounted();
  // }, [])

  return (
    <div style={getItemStyles()}>
      <Stack direction="column">
        {state.title && <h2>{state.title}</h2>}
        <div>timeRange from: {timeRange.from.toLocaleString()}</div>
        <div>timeRange to: {timeRange.to.toLocaleString()}</div>
      </Stack>
    </div>
  );
});

ScenePanelRenderer.displayName = 'ScenePanelRenderer';

function getItemStyles() {
  const style: CSSProperties = {
    display: 'flex',
    border: '1px solid red',
    height: '100%',
    width: '100%',
  };

  return style;
}
