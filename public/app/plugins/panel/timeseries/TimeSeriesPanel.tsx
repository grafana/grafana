import { Field, PanelProps } from '@grafana/data';
import { GraphNG, GraphNGLegendEvent, TooltipPlugin, ZoomPlugin } from '@grafana/ui';
import { getFieldLinksForExplore } from 'app/features/explore/utils/links';
import React, { useCallback } from 'react';
import { changeSeriesColorConfigFactory } from './overrides/colorSeriesConfigFactory';
import { hideSeriesConfigFactory } from './overrides/hideSeriesConfigFactory';
import { AnnotationsPlugin } from './plugins/AnnotationsPlugin';
import { ContextMenuPlugin } from './plugins/ContextMenuPlugin';
import { ExemplarsPlugin } from './plugins/ExemplarsPlugin';
import { Options } from './types';

interface TimeSeriesPanelProps extends PanelProps<Options> {}

export const TimeSeriesPanel: React.FC<TimeSeriesPanelProps> = ({
  data,
  timeRange,
  timeZone,
  width,
  height,
  options,
  fieldConfig,
  onChangeTimeRange,
  onFieldConfigChange,
  replaceVariables,
}) => {
  const onLegendClick = useCallback(
    (event: GraphNGLegendEvent) => {
      onFieldConfigChange(hideSeriesConfigFactory(event, fieldConfig, data.series));
    },
    [fieldConfig, onFieldConfigChange, data.series]
  );

  const getFieldLinks = (field: Field, rowIndex: number) => {
    return getFieldLinksForExplore({ field, rowIndex, range: timeRange });
  };

  const onSeriesColorChange = useCallback(
    (label: string, color: string) => {
      onFieldConfigChange(changeSeriesColorConfigFactory(label, color, fieldConfig));
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
      onSeriesColorChange={onSeriesColorChange}
    >
      <TooltipPlugin mode={options.tooltipOptions.mode} timeZone={timeZone} />
      <ZoomPlugin onZoom={onChangeTimeRange} />
      <ContextMenuPlugin timeZone={timeZone} replaceVariables={replaceVariables} />
      {data.annotations && (
        <ExemplarsPlugin exemplars={data.annotations} timeZone={timeZone} getFieldLinks={getFieldLinks} />
      )}
      {data.annotations && <AnnotationsPlugin annotations={data.annotations} timeZone={timeZone} />}
    </GraphNG>
  );
};
