import React, { RefCallback } from 'react';
import { useLocation, useMeasure } from 'react-use';

import { PluginContextProvider, urlUtil } from '@grafana/data';
import { locationSearchToObject } from '@grafana/runtime';
import { PanelChrome, ErrorBoundaryAlert } from '@grafana/ui';
import { appEvents } from 'app/core/core';
import { useFieldOverrides } from 'app/features/panel/components/PanelRenderer';

import { sceneGraph } from '../../core/sceneGraph';
import { SceneComponentProps, UrlLinkDef } from '../../core/types';
import { SceneQueryRunner } from '../../querying/SceneQueryRunner';
import { SceneDragHandle } from '../SceneDragHandle';

import { VizPanel } from './VizPanel';

export function VizPanelRenderer({ model }: SceneComponentProps<VizPanel>) {
  const { title, titleLink, options, fieldConfig, pluginId, pluginLoadError, displayMode, $data, ...state } =
    model.useState();
  const [ref, { width, height }] = useMeasure();
  const plugin = model.getPlugin();
  const { data } = sceneGraph.getData(model).useState();
  const layout = sceneGraph.getLayout(model);

  const isDraggable = layout.state.isDraggable ? state.isDraggable : false;
  const dragHandle = <SceneDragHandle layoutKey={layout.state.key!} />;

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
        title={titleLink ? <PanelTitleLink title={titleInterpolated} link={titleLink} /> : titleInterpolated}
        width={width}
        height={height}
        padding={plugin.noPadding ? 'none' : undefined}
        leftItems={isDraggable ? [dragHandle] : undefined}
        displayMode={displayMode}
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

function PanelTitleLink({ title, link }: { title: string; link: UrlLinkDef }) {
  const location = useLocation();
  const queryParms = locationSearchToObject(location.search || '');
  // TODO only include query params that are specified in UrlLinkDef definition
  const url = urlUtil.renderUrl(link.path, queryParms);

  return <a href={url}>{title}</a>;
}
