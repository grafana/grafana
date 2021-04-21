import { Field, FieldMatcherID, fieldMatchers, PanelProps } from '@grafana/data';
import { GraphNG, GraphNGLegendEvent, TooltipPlugin, ZoomPlugin, preparePlotFrame } from '@grafana/ui';
import { getFieldLinksForExplore } from 'app/features/explore/utils/links';
import React, { useCallback, useMemo } from 'react';
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
  // Invalidate data alignment on data change only. Primarily, to reduce plot frame calc on changes that are not triggered by
  // query results (width, height, options)
  const frame = useMemo(() => {
    return (
      data?.series &&
      preparePlotFrame(data.series, {
        x: fieldMatchers.get(FieldMatcherID.firstTimeField).get({}),
        y: fieldMatchers.get(FieldMatcherID.numeric).get({}),
      })
    );
  }, [data]);

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

  if (!data || !data.series?.length || !frame) {
    return (
      <div className="panel-empty">
        <p>No data found in response</p>
      </div>
    );
  }

  return (
    <GraphNG
      data={data.series}
      alignedData={frame}
      structureRev={data.structureRev}
      timeRange={timeRange}
      timeZone={timeZone}
      width={width}
      height={height}
      legend={options.legend}
      onLegendClick={onLegendClick}
      onSeriesColorChange={onSeriesColorChange}
    >
      <ZoomPlugin onZoom={onChangeTimeRange} />
      <TooltipPlugin data={frame} mode={options.tooltipOptions.mode} timeZone={timeZone} />
      <ContextMenuPlugin data={frame} timeZone={timeZone} replaceVariables={replaceVariables} />
      {data.annotations && (
        <ExemplarsPlugin exemplars={data.annotations} timeZone={timeZone} getFieldLinks={getFieldLinks} />
      )}
      {data.annotations && <AnnotationsPlugin annotations={data.annotations} timeZone={timeZone} />}
    </GraphNG>
  );
};
