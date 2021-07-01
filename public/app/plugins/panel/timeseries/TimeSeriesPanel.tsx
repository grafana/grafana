import { DashboardCursorSync, Field, PanelProps } from '@grafana/data';
import { config } from '@grafana/runtime';
import { TooltipDisplayMode, usePanelContext, TimeSeries, TooltipPlugin, ZoomPlugin } from '@grafana/ui';
import { getFieldLinksForExplore } from 'app/features/explore/utils/links';
import React, { useMemo } from 'react';
import { AnnotationsPlugin } from './plugins/AnnotationsPlugin';
import { ContextMenuPlugin } from './plugins/ContextMenuPlugin';
import { ExemplarsPlugin } from './plugins/ExemplarsPlugin';
import { TimeSeriesOptions } from './types';
import { prepareGraphableFields } from './utils';
import { AnnotationEditorPlugin } from './plugins/AnnotationEditorPlugin';

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
  const { sync, canAddAnnotations } = usePanelContext();

  const getFieldLinks = (field: Field, rowIndex: number) => {
    return getFieldLinksForExplore({ field, rowIndex, range: timeRange });
  };

  const { frames, warn } = useMemo(() => prepareGraphableFields(data?.series, config.theme2), [data]);

  if (!frames || warn) {
    return (
      <div className="panel-empty">
        <p>{warn ?? 'No data found in response'}</p>
      </div>
    );
  }

  const enableAnnotationCreation = Boolean(canAddAnnotations && canAddAnnotations());
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
            {/* Renders annotation markers*/}
            {data.annotations && (
              <AnnotationsPlugin annotations={data.annotations} config={config} timeZone={timeZone} />
            )}
            {/* Enables annotations creation*/}
            <AnnotationEditorPlugin data={alignedDataFrame} timeZone={timeZone} config={config}>
              {({ startAnnotating }) => {
                return (
                  <ContextMenuPlugin
                    data={alignedDataFrame}
                    config={config}
                    timeZone={timeZone}
                    replaceVariables={replaceVariables}
                    defaultItems={
                      enableAnnotationCreation
                        ? [
                            {
                              items: [
                                {
                                  label: 'Add annotation',
                                  ariaLabel: 'Add annotation',
                                  icon: 'comment-alt',
                                  onClick: (e, p) => {
                                    if (!p) {
                                      return;
                                    }
                                    startAnnotating({ coords: p.coords });
                                  },
                                },
                              ],
                            },
                          ]
                        : []
                    }
                  />
                );
              }}
            </AnnotationEditorPlugin>
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
