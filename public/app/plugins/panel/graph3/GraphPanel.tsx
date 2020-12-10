import React from 'react';
import { TooltipPlugin, ZoomPlugin, GraphNG } from '@grafana/ui';
import { PanelProps } from '@grafana/data';
import { Options } from './types';
import { AnnotationsPlugin } from './plugins/AnnotationsPlugin';
import { ExemplarsPlugin } from './plugins/ExemplarsPlugin';
import { ContextMenuPlugin } from './plugins/ContextMenuPlugin';

interface GraphPanelProps extends PanelProps<Options> {}

export const GraphPanel: React.FC<GraphPanelProps> = ({
  data,
  timeRange,
  timeZone,
  width,
  height,
  options,
  onChangeTimeRange,
  replaceVariables,
}) => {
  return (
    <GraphNG
      data={data.series}
      timeRange={timeRange}
      timeZone={timeZone}
      width={width}
      height={height}
      legend={options.legend}
    >
      <TooltipPlugin mode={options.tooltipOptions.mode as any} timeZone={timeZone} />
      <ZoomPlugin onZoom={onChangeTimeRange} />
      <ContextMenuPlugin
        timeZone={timeZone}
        defaultItems={defaultContextMenuLinks}
        replaceVariables={replaceVariables}
      />
      {data.annotations ? <ExemplarsPlugin exemplars={data.annotations} timeZone={timeZone} /> : <></>}
      {data.annotations ? <AnnotationsPlugin annotations={data.annotations} timeZone={timeZone} /> : <></>}
    </GraphNG>
  );
};
