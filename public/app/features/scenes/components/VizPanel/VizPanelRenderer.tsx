import React, { RefCallback } from 'react';
import { useMeasure } from 'react-use';

import { PluginContextProvider } from '@grafana/data';
import { PanelChrome, ErrorBoundaryAlert } from '@grafana/ui';
import { appEvents } from 'app/core/core';
import { useFieldOverrides } from 'app/features/panel/components/PanelRenderer';

import { sceneGraph } from '../../core/sceneGraph';
import { SceneComponentProps } from '../../core/types';
import { SceneQueryRunner } from '../../querying/SceneQueryRunner';
import { SceneDragHandle } from '../SceneDragHandle';

import { VizPanel } from './VizPanel';

export function VizPanelRenderer({ model }: SceneComponentProps<VizPanel>) {
  const { title, options, fieldConfig, pluginId, pluginLoadError, $data, layout: layoutOptions } = model.useState();
  const [ref, { width, height }] = useMeasure();
  const plugin = model.getPlugin();
  const { data } = sceneGraph.getData(model).useState();
  const parentLayout = sceneGraph.getLayout(model);

  // TODO: this should probably be parentLayout.isDraggingEnabled() ? layoutOptions?.isDraggable : false
  // The current logic is not correct, just because parent layout itself is not draggable does not mean children are not
  const isDraggable = parentLayout.state.layout?.isDraggable ? layoutOptions?.isDraggable : false;
  const dragHandle = <SceneDragHandle layoutKey={parentLayout.state.key!} />;

  const titleInterpolated = sceneGraph.interpolate(model, title);

  // Not sure we need to subscribe to this state
  const timeZone = sceneGraph.getTimeRange(model).state.timeZone;

  const dataWithOverrides = useFieldOverrides(plugin, fieldConfig, data, timeZone);

  if (pluginLoadError) {
    return <div>Failed to load plugin: {pluginLoadError}</div>;
  }

  if (!plugin || !plugin.hasPluginId(pluginId)) {
    return <div>Loading plugin panel...</div>;
  }

  if (!plugin.panel) {
    return <div>Panel plugin has no panel component</div>;
  }

  const PanelComponent = plugin.panel;

  // Query runner needs to with for auto maxDataPoints
  if ($data instanceof SceneQueryRunner) {
    $data.setContainerWidth(width);
  }

  return (
    <div ref={ref as RefCallback<HTMLDivElement>} style={{ position: 'absolute', width: '100%', height: '100%' }}>
      <PanelChrome
        title={titleInterpolated}
        width={width}
        height={height}
        leftItems={isDraggable ? [dragHandle] : undefined}
      >
        {(innerWidth, innerHeight) => (
          <>
            {!dataWithOverrides && <div>No data...</div>}
            {dataWithOverrides && (
              <ErrorBoundaryAlert dependencies={[plugin, data]}>
                <PluginContextProvider meta={plugin.meta}>
                  <PanelComponent
                    id={1}
                    data={dataWithOverrides}
                    title={title}
                    timeRange={dataWithOverrides.timeRange}
                    timeZone={timeZone}
                    options={options}
                    fieldConfig={fieldConfig}
                    transparent={false}
                    width={innerWidth}
                    height={innerHeight}
                    renderCounter={0}
                    replaceVariables={(str: string) => str}
                    onOptionsChange={model.onOptionsChange}
                    onFieldConfigChange={model.onFieldConfigChange}
                    onChangeTimeRange={model.onChangeTimeRange}
                    eventBus={appEvents}
                  />
                </PluginContextProvider>
              </ErrorBoundaryAlert>
            )}
          </>
        )}
      </PanelChrome>
    </div>
  );
}

VizPanelRenderer.displayName = 'ScenePanelRenderer';
