import React from 'react';
import { ContextMenuPlugin, TooltipPlugin, ZoomPlugin, GraphNG } from '@grafana/ui';
import { FieldMatcherID, PanelProps } from '@grafana/data';
import { Options } from './types';
import { AnnotationsPlugin } from './plugins/AnnotationsPlugin';
import { ExemplarsPlugin } from './plugins/ExemplarsPlugin';
import { GraphNGLegendItem } from '@grafana/ui/src/components/GraphNG/GraphNG';

interface GraphPanelProps extends PanelProps<Options> {}

export const GraphPanel: React.FC<GraphPanelProps> = ({
  data,
  timeRange,
  timeZone,
  width,
  height,
  options,
  fieldConfig,
  onChangeTimeRange,
  onFieldConfigChange,
}) => {
  return (
    <GraphNG
      data={data.series}
      timeRange={timeRange}
      timeZone={timeZone}
      width={width}
      height={height}
      legend={options.legend}
      onLegendClick={(legend: GraphNGLegendItem) => {
        onFieldConfigChange({
          ...fieldConfig,
          overrides: [
            ...fieldConfig.overrides,
            {
              matcher: {
                id: FieldMatcherID.byRegexp,
                options: `^(?!${legend.label}$).*$`,
              },
              properties: [
                {
                  id: 'custom.seriesConfig',
                  value: {
                    displayInGraph: false,
                    displayInLegend: true,
                    displayInTooltip: true,
                  },
                },
              ],
            },
          ],
        });
      }}
    >
      <TooltipPlugin mode={options.tooltipOptions.mode as any} timeZone={timeZone} />
      <ZoomPlugin onZoom={onChangeTimeRange} />
      <ContextMenuPlugin />
      {data.annotations ? <ExemplarsPlugin exemplars={data.annotations} timeZone={timeZone} /> : <></>}
      {data.annotations ? <AnnotationsPlugin annotations={data.annotations} timeZone={timeZone} /> : <></>}
    </GraphNG>
  );
};
