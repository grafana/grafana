import React from 'react';
import AutoSizer from 'react-virtualized-auto-sizer';

import { PanelRenderer } from '@grafana/runtime';
import { PanelChrome } from '@grafana/ui';

import { SceneComponentProps, SceneItemBase, SceneLayoutItemChildState } from './SceneItem';

export interface VizPanelState extends SceneLayoutItemChildState {
  title?: string;
  pluginId: string;
  options?: any;
}

export class VizPanel extends SceneItemBase<VizPanelState> {
  Component = ScenePanelRenderer;

  constructor(state: VizPanelState) {
    super(state);
  }
}

const ScenePanelRenderer = React.memo<SceneComponentProps<VizPanel>>(({ model }) => {
  const { title, pluginId, options } = model.useState();
  const { data } = model.getData().useState();

  return (
    <AutoSizer>
      {({ width, height }) => {
        if (width < 3 || height < 3 || !data) {
          return null;
        }

        return (
          <PanelChrome title={title} width={width} height={height}>
            {(innerWidth, innerHeight) => (
              <>
                <PanelRenderer
                  title="Raw data"
                  pluginId={pluginId}
                  width={innerWidth}
                  height={innerHeight}
                  data={data}
                  options={options}
                  onOptionsChange={() => {}}
                  onChangeTimeRange={model.onSetTimeRange}
                />
              </>
            )}
          </PanelChrome>
        );
      }}
    </AutoSizer>
  );
});

ScenePanelRenderer.displayName = 'ScenePanelRenderer';
