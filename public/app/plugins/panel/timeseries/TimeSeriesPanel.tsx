import { ArrayVector, DashboardCursorSync, DataFrame, Field, FieldType, PanelProps } from '@grafana/data';
import { TooltipDisplayMode, usePanelContext, TimeSeries, TooltipPlugin, ZoomPlugin } from '@grafana/ui';
import { getFieldLinksForExplore } from 'app/features/explore/utils/links';
import React, { useMemo } from 'react';
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

  const { frames, warn } = useMemo(() => filterGraphableFields(data?.series), [data]);

  if (!frames || warn) {
    return (
      <div className="panel-empty">
        <p>{warn ?? 'No data found in response'}</p>
      </div>
    );
  }

  return (
    <TimeSeries
      frames={frames}
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

// This will return a set of frames with only graphable values included
export function filterGraphableFields(series?: DataFrame[]): { frames?: DataFrame[]; warn?: string } {
  if (!series?.length) {
    return { warn: 'No data in response' };
  }
  let hasTimeseries = false;
  const frames: DataFrame[] = [];
  for (let frame of series) {
    let isTimeseries = false;
    let changed = false;
    const fields: Field[] = [];
    for (const field of frame.fields) {
      switch (field.type) {
        case FieldType.time:
          isTimeseries = true;
          fields.push(field);
          break;
        case FieldType.number:
          fields.push(field);
          break; // ok
        case FieldType.boolean:
          changed = true;
          fields.push({
            ...field,
            config: {
              ...field.config,
              unit: 'boolean', // TODO
            },
            type: FieldType.number,
            values: new ArrayVector(
              field.values.toArray().map((v) => {
                if (v == null) {
                  return v;
                }
                return Boolean(v) ? 1 : 0;
              })
            ),
          });
          break;
        default:
          changed = true;
      }
    }
    if (isTimeseries && fields.length > 1) {
      hasTimeseries = true;
      if (changed) {
        frames.push({
          ...frame,
          fields,
        });
      } else {
        frames.push(frame);
      }
    }
  }

  if (!hasTimeseries) {
    return { warn: 'Data does not have a time field' };
  }
  if (!frames.length) {
    return { warn: 'No graphable fields' };
  }
  return { frames };
}
