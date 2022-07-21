import React from 'react';
import AutoSizer from 'react-virtualized-auto-sizer';

import { AbsoluteTimeRange, FieldConfigSource, toUtc } from '@grafana/data';
import { PanelRenderer } from '@grafana/runtime';
import { Field, PanelChrome, Input } from '@grafana/ui';

import { SceneObjectBase } from '../core/SceneObjectBase';
import { SceneComponentProps, SceneLayoutChildState } from '../core/types';

export interface VizPanelState extends SceneLayoutChildState {
  title?: string;
  pluginId: string;
  options?: object;
  fieldConfig?: FieldConfigSource;
}

export class VizPanel extends SceneObjectBase<VizPanelState> {
  static Component = ScenePanelRenderer;
  static Editor = VizPanelEditor;

  onSetTimeRange = (timeRange: AbsoluteTimeRange) => {
    const sceneTimeRange = this.getTimeRange();
    sceneTimeRange.setState({
      raw: {
        from: toUtc(timeRange.from),
        to: toUtc(timeRange.to),
      },
      from: toUtc(timeRange.from),
      to: toUtc(timeRange.to),
    });
  };
}

function ScenePanelRenderer({ model }: SceneComponentProps<VizPanel>) {
  const { title, pluginId, options, fieldConfig } = model.useState();
  const { data } = model.getData().useState();

  return (
    <AutoSizer>
      {({ width, height }) => {
        if (width < 3 || height < 3) {
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
}

ScenePanelRenderer.displayName = 'ScenePanelRenderer';

function VizPanelEditor({ model }: SceneComponentProps<VizPanel>) {
  const { title } = model.useState();

  return (
    <Field label="Title">
      <Input defaultValue={title} onBlur={(evt) => model.setState({ title: evt.currentTarget.value })} />
    </Field>
  );
}
