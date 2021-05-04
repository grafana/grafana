import { Field, PanelProps } from '@grafana/data';
import { GraphNG, GraphNGLegendEvent, TooltipPlugin, ZoomPlugin } from '@grafana/ui';
import { getFieldLinksForExplore } from 'app/features/explore/utils/links';
import React, { useCallback } from 'react';
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

  if (!data || !data.series?.length) {
    return (
      <div className="panel-empty">
        <p>No data found in response</p>
      </div>
    );
  }

  return (
    <GraphNG
      data={data.series}
      structureRev={data.structureRev}
      timeRange={timeRange}
      timeZone={timeZone}
      width={width}
      height={height}
      legend={options.legend}
      onLegendClick={onLegendClick}
    >
      {(config, alignedDataFrame) => {
        return (
          <>
            <ZoomPlugin config={config} onZoom={onChangeTimeRange} />
            <TooltipPlugin
              data={alignedDataFrame}
              config={config}
              mode={options.tooltipOptions.mode}
              timeZone={timeZone}
            />
            <ContextMenuPlugin
              data={alignedDataFrame}
              config={config}
              timeZone={timeZone}
              replaceVariables={replaceVariables}
            />
            {data.annotations && (
              <AnnotationsPlugin annotations={data.annotations} config={config} timeZone={timeZone} />
            )}

            {data.annotations && (
              <ExemplarsPlugin
                config={config}
                exemplars={data.annotations}
                timeZone={timeZone}
                getFieldLinks={getFieldLinks}
              />
            )}
          </>
        );
      }}
    </GraphNG>
  );
};
