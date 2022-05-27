import React, { CSSProperties } from 'react';
import AutoSizer from 'react-virtualized-auto-sizer';

import { Stack } from '@grafana/experimental';
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
  const { data } = model.useData();

  // useEffect(() => {
  //   model.mounted();
  //   return model.unmounted();
  // }, [])

  return (
    <div style={getItemStyles()}>
      <Stack direction="column">
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
                    />
                  </>
                )}
              </PanelChrome>
            );
          }}
        </AutoSizer>
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
