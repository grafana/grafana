import React from 'react';
import { TooltipPlugin, ZoomPlugin, GraphNG, MenuItemsGroup } from '@grafana/ui';
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
}) => {
  const defaultContextMenuLinks: MenuItemsGroup[] = [
    {
      items: [
        {
          label: 'Add annotation',
          icon: 'comment-alt',
          onClick: () => {
            alert('TODO');
          },
        },
      ],
    },
  ];

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
      <ContextMenuPlugin timeZone={timeZone} defaultItems={defaultContextMenuLinks} />
      {data.annotations ? <ExemplarsPlugin exemplars={data.annotations} timeZone={timeZone} /> : <></>}
      {data.annotations ? <AnnotationsPlugin annotations={data.annotations} timeZone={timeZone} /> : <></>}
    </GraphNG>
  );
};
