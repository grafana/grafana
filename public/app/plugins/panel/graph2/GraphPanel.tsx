import React from 'react';
import { GraphWithLegend, Chart, MicroPlot } from '@grafana/ui';
import { PanelProps, applyFieldOverrides } from '@grafana/data';
import { Options } from './types';
import { GraphPanelController } from './GraphPanelController';
import { LegendDisplayMode } from '@grafana/ui/src/components/Legend/Legend';
import { config } from 'app/core/config';

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
  replaceVariables,
}) => {
  if (!data) {
    return (
      <div className="panel-empty">
        <p>No data found in response</p>
      </div>
    );
  }

  const {
    graph: { showLines, showBars, showPoints, useMicroPlot },
    legend: legendOptions,
    tooltipOptions,
  } = options;

  if (useMicroPlot) {
    const dataProcessed = applyFieldOverrides({
      data: data.series,
      fieldOptions: options.fieldOptions,
      theme: config.theme,
      replaceVariables,
    })[0];

    return (
      <div>
        <MicroPlot width={width} height={height} data={dataProcessed} />
      </div>
    );
  }

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
