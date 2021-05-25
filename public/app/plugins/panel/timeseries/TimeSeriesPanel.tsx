import { anySeriesWithTimeField, DashboardCursorSync, Field, PanelProps } from '@grafana/data';
import { TooltipDisplayMode, usePanelContext, TimeSeries, TooltipPlugin, ZoomPlugin } from '@grafana/ui';
import { getFieldLinksForExplore } from 'app/features/explore/utils/links';
import React from 'react';
import { AnnotationsPlugin } from './plugins/AnnotationsPlugin';
import { ContextMenuPlugin } from './plugins/ContextMenuPlugin';
import { ExemplarsPlugin } from './plugins/ExemplarsPlugin';
import { TimeSeriesOptions } from './types';

interface TimeSeriesPanelProps extends PanelProps<TimeSeriesOptions> {}

export const TimeSeriesPanel: React.FC<TimeSeriesPanelProps> = ({
  data,
  timeRange,
  timeZone,
  width,
  height,
  options,
  onChangeTimeRange,
  replaceVariables,
}) => {
  const { sync } = usePanelContext();

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

  if (!anySeriesWithTimeField(data.series)) {
    return (
      <div className="panel-empty">
        <p>Missing time field in the data</p>
      </div>
    );
  }

  return (
    <TimeSeries
      frames={data.series}
      structureRev={data.structureRev}
      timeRange={timeRange}
      timeZone={timeZone}
      width={width}
      height={height}
      legend={options.legend}
    >
      {(config, alignedDataFrame) => {
        return (
          <>
            <ZoomPlugin config={config} onZoom={onChangeTimeRange} />
            <TooltipPlugin
              data={alignedDataFrame}
              config={config}
              mode={sync === DashboardCursorSync.Tooltip ? TooltipDisplayMode.Multi : options.tooltip.mode}
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
    </TimeSeries>
  );
};
