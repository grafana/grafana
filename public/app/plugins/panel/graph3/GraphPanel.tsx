import React, { useCallback } from 'react';
import { ContextMenuPlugin, TooltipPlugin, ZoomPlugin, GraphNG, GraphNGLegendEvent } from '@grafana/ui';
import { FieldMatcherID, getFieldDisplayName, PanelProps } from '@grafana/data';
import { Options } from './types';
import { AnnotationsPlugin } from './plugins/AnnotationsPlugin';
import { ExemplarsPlugin } from './plugins/ExemplarsPlugin';

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
  const onLegendClick = useCallback(
    (event: GraphNGLegendEvent) => {
      const { field, frame, data } = event;
      const displayName = getFieldDisplayName(field, frame, data);

      onFieldConfigChange({
        ...fieldConfig,
        overrides: [
          ...fieldConfig.overrides,
          {
            matcher: {
              id: FieldMatcherID.byRegexp,
              options: `^(?!${displayName}$).*$`,
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
    },
    [fieldConfig, onFieldConfigChange]
  );

  return (
    <GraphNG
      data={data.series}
      timeRange={timeRange}
      timeZone={timeZone}
      width={width}
      height={height}
      legend={options.legend}
      onLegendClick={onLegendClick}
    >
      <TooltipPlugin mode={options.tooltipOptions.mode as any} timeZone={timeZone} />
      <ZoomPlugin onZoom={onChangeTimeRange} />
      <ContextMenuPlugin />
      {data.annotations ? <ExemplarsPlugin exemplars={data.annotations} timeZone={timeZone} /> : <></>}
      {data.annotations ? <AnnotationsPlugin annotations={data.annotations} timeZone={timeZone} /> : <></>}
    </GraphNG>
  );
};
