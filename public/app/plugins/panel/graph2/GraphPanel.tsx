import React from 'react';
import { GraphWithLegend, Chart } from '@grafana/ui';
import { PanelProps } from '@grafana/data';
import { Options } from './types';
import { GraphPanelController } from './GraphPanelController';
import { LegendDisplayMode } from '@grafana/ui/src/components/Legend/Legend';

interface GraphPanelProps extends PanelProps<Options> {}

export const GraphPanel: React.FunctionComponent<GraphPanelProps> = ({
  data,
  timeRange,
  timeZone,
  width,
  height,
  options,
  onOptionsChange,
  onChangeTimeRange,
}) => {
  if (!data) {
    return (
      <div className="panel-empty">
        <p>No data found in response</p>
      </div>
    );
  }

  const {
    graph: { showLines, showBars, showPoints },
    legend: legendOptions,
    tooltipOptions,
  } = options;

  const graphProps = {
    showBars,
    showLines,
    showPoints,
    tooltipOptions,
  };
  const { asTable, isVisible, ...legendProps } = legendOptions;
  return (
    <GraphPanelController
      data={data}
      timeZone={timeZone}
      options={options}
      onOptionsChange={onOptionsChange}
      onChangeTimeRange={onChangeTimeRange}
    >
      {({ onSeriesToggle, onHorizontalRegionSelected, ...controllerApi }) => {
        return (
          <GraphWithLegend
            timeRange={timeRange}
            timeZone={timeZone}
            width={width}
            height={height}
            displayMode={asTable ? LegendDisplayMode.Table : LegendDisplayMode.List}
            isLegendVisible={isVisible}
            sortLegendBy={legendOptions.sortBy}
            sortLegendDesc={legendOptions.sortDesc}
            onSeriesToggle={onSeriesToggle}
            onHorizontalRegionSelected={onHorizontalRegionSelected}
            {...graphProps}
            {...legendProps}
            {...controllerApi}
          >
            <Chart.Tooltip mode={tooltipOptions.mode} />
          </GraphWithLegend>
        );
      }}
    </GraphPanelController>
  );
};
