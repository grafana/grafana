import React from 'react';
import { PanelProps, GraphWithLegend /*, GraphSeriesXY*/ } from '@grafana/ui';
import { Options } from './types';
import { GraphPanelController } from './GraphPanelController';
import { LegendDisplayMode } from '@grafana/ui/src/components/Legend/Legend';

interface GraphPanelProps extends PanelProps<Options> {}

export const GraphPanel: React.FunctionComponent<GraphPanelProps> = ({
  data,
  timeRange,
  width,
  height,
  options,
  onOptionsChange,
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
  } = options;

  const graphProps = {
    showBars,
    showLines,
    showPoints,
  };
  const { asTable, isVisible, ...legendProps } = legendOptions;
  return (
    <GraphPanelController data={data} options={options} onOptionsChange={onOptionsChange}>
      {({ onSeriesToggle, ...controllerApi }) => {
        return (
          <GraphWithLegend
            timeRange={timeRange}
            width={width}
            height={height}
            displayMode={asTable ? LegendDisplayMode.Table : LegendDisplayMode.List}
            isLegendVisible={isVisible}
            sortLegendBy={legendOptions.sortBy}
            sortLegendDesc={legendOptions.sortDesc}
            onSeriesToggle={onSeriesToggle}
            {...graphProps}
            {...legendProps}
            {...controllerApi}
          />
        );
      }}
    </GraphPanelController>
  );
};
