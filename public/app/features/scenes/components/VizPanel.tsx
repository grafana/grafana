import React from 'react';
import AutoSizer from 'react-virtualized-auto-sizer';

import { AbsoluteTimeRange, FieldConfigSource, toUtc } from '@grafana/data';
import { PanelRenderer } from '@grafana/runtime';
import { Field, PanelChrome, Input } from '@grafana/ui';

import { SceneObjectBase } from '../core/SceneObjectBase';
import { sceneGraph } from '../core/sceneGraph';
import { SceneComponentProps, SceneLayoutChildState } from '../core/types';
import { VariableDependencyConfig } from '../variables/VariableDependencyConfig';

import { SceneDragHandle } from './SceneDragHandle';

export interface VizPanelState extends SceneLayoutChildState {
  title?: string;
  pluginId: string;
  options?: object;
  fieldConfig?: FieldConfigSource;
}

export class VizPanel extends SceneObjectBase<VizPanelState> {
  public static Component = ScenePanelRenderer;
  public static Editor = VizPanelEditor;

  protected _variableDependency = new VariableDependencyConfig(this, {
    statePaths: ['title'],
  });

  public changeTitle(title: string) {
    this.setState({ title });
  }

  public onSetTimeRange = (timeRange: AbsoluteTimeRange) => {
    const sceneTimeRange = sceneGraph.getTimeRange(this);
    sceneTimeRange.onTimeRangeChange({
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
  const { title, pluginId, options, fieldConfig, ...state } = model.useState();
  const { data } = sceneGraph.getData(model).useState();

  const layout = sceneGraph.getLayout(model);
  const isDraggable = layout.state.isDraggable ? state.isDraggable : false;
  const dragHandle = <SceneDragHandle layoutKey={layout.state.key!} />;

  const titleInterpolated = sceneGraph.interpolate(model, title);

  return (
    <AutoSizer>
      {({ width, height }) => {
        if (width < 3 || height < 3) {
          return null;
        }

        return (
          <PanelChrome
            title={titleInterpolated}
            width={width}
            height={height}
            leftItems={isDraggable ? [dragHandle] : undefined}
          >
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
      <Input defaultValue={title} onBlur={(evt) => model.changeTitle(evt.currentTarget.value)} />
    </Field>
  );
}
