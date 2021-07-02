import { DashboardCursorSync, Field, PanelProps } from '@grafana/data';
import { config } from '@grafana/runtime';
import { TooltipDisplayMode, usePanelContext, TooltipPlugin, ZoomPlugin } from '@grafana/ui';
import { CandlestickPlot } from './CandlestickPlot2';
import { getFieldLinksForExplore } from 'app/features/explore/utils/links';
import React, { useMemo } from 'react';
import { AnnotationsPlugin } from '../timeseries/plugins/AnnotationsPlugin';
import { ContextMenuPlugin } from '../timeseries/plugins/ContextMenuPlugin';
import { ExemplarsPlugin } from '../timeseries/plugins/ExemplarsPlugin';
import { TimeSeriesOptions } from '../timeseries/types';
import { prepareCandlestickFields } from './utils';
import { PanelOptions } from './models.gen';

interface CandelstickPanelProps extends PanelProps<TimeSeriesOptions | PanelOptions> {}

export const CandlestickPanel: React.FC<CandelstickPanelProps> = ({
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

  const { frames, warn } = useMemo(() => prepareCandlestickFields(data?.series, config.theme2, options), [
    data,
    options,
  ]);

  if (!frames || warn) {
    return (
      <div className="panel-empty">
        <p>{warn ?? 'No data found in response'}</p>
      </div>
    );
  }

  return (
    <CandlestickPlot
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
    </CandlestickPlot>
  );
};
