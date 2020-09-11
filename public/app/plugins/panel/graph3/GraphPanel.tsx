import React, { useMemo } from 'react';
import { ContextMenuPlugin, TooltipPlugin, UPlotChart, ZoomPlugin } from '@grafana/ui';
import { PanelProps } from '@grafana/data';
import { Options } from './types';
import { alignAndSortDataFramesByFieldName } from './utils';

interface GraphPanelProps extends PanelProps<Options> {}

const TIME_FIELD_NAME = 'Time';

export const GraphPanel: React.FunctionComponent<GraphPanelProps> = ({
  data,
  timeRange,
  timeZone,
  width,
  height,
  options,
  fieldConfig,
  onOptionsChange,
  onChangeTimeRange,
  replaceVariables,
}) => {
  const alignedData = useMemo(() => {
    if (!data || !data.series?.length) {
      return null;
    }
    return alignAndSortDataFramesByFieldName(data.series, TIME_FIELD_NAME);
  }, [data]);

  if (!alignedData) {
    return (
      <div className="panel-empty">
        <p>No data found in response</p>
      </div>
    );
  }

  return (
    <UPlotChart data={alignedData} timeRange={timeRange} width={width} height={height}>
      {/*<PlotLegend />*/}
      {options.tooltipOptions.mode !== 'none' && (
        <TooltipPlugin mode={options.tooltipOptions.mode as any} timeZone={timeZone} />
      )}
      <ZoomPlugin onZoom={onChangeTimeRange} />
      <ContextMenuPlugin />
    </UPlotChart>

    // <MicroPlot
    //   timeRange={timeRange}
    //   timeZone={timeZone}
    //   realTimeUpdates={options.graph.realTimeUpdates}
    //   width={width}
    //   height={height}
    //   data={data.series}
    //   theme={config.theme}
    // />
  );
};
