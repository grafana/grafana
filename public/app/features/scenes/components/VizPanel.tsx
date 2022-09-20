import React from 'react';
import AutoSizer from 'react-virtualized-auto-sizer';

import { AbsoluteTimeRange, FieldConfigSource, toUtc } from '@grafana/data';
import { PanelRenderer } from '@grafana/runtime';
import { Field, PanelChrome, Input } from '@grafana/ui';

import { SceneDataObject, SceneObjectBase } from '../core/SceneObjectBase';
import { SceneComponentProps, SceneLayoutChildState, SceneParametrizedState } from '../core/types';
import { SceneDataProviderNode } from '../core/SceneDataProviderNode';

export type SceneVizPanelInputParams<TData extends SceneDataObject<any> = SceneDataObject<any>> = {
  data: TData;
};
export interface VizPanelState<T extends SceneDataObject<any> = SceneDataObject<any>>
  extends SceneLayoutChildState,
    SceneParametrizedState<SceneVizPanelInputParams<T>> {
  title?: string;
  pluginId: string;
  options?: object;
  fieldConfig?: FieldConfigSource;
}

export class VizPanel<T extends SceneDataObject<any> = SceneDataProviderNode> extends SceneObjectBase<
  VizPanelState<T>
> {
  static Component = ScenePanelRenderer;
  static Editor = VizPanelEditor;

  onSetTimeRange = (timeRange: AbsoluteTimeRange) => {
    const sceneTimeRange = this.getTimeRange();
    sceneTimeRange.setState({
      range: {
        raw: {
          from: toUtc(timeRange.from),
          to: toUtc(timeRange.to),
        },
        from: toUtc(timeRange.from),
        to: toUtc(timeRange.to),
      },
    });
  };

  toJSON() {
    const { $editor, $variables, ...rest } = this.state;
    return rest;
  }
}

function ScenePanelRenderer({ model }: SceneComponentProps<VizPanel>) {
  const { title, pluginId, options, fieldConfig } = model.useState();
  const { $data } = model.getData().useState();

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
                  data={$data}
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
