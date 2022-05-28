import React from 'react';
import AutoSizer from 'react-virtualized-auto-sizer';

import { FieldConfigSource } from '@grafana/data';
import { PanelRenderer } from '@grafana/runtime';
import { PanelChrome } from '@grafana/ui';

import { SceneItemBase } from './SceneItem';
import { SceneComponentProps, SceneItemState } from './types';

export interface VizPanelState extends SceneItemState {
  title?: string;
  pluginId: string;
  options?: any;
  fieldConfig?: FieldConfigSource;
}

export class VizPanel extends SceneItemBase<VizPanelState> {
  Component = ScenePanelRenderer;
}

const ScenePanelRenderer = React.memo<SceneComponentProps<VizPanel>>(({ model }) => {
  const { title, pluginId, options, fieldConfig } = model.useMount().useState();
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
                  fieldConfig={fieldConfig}
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
