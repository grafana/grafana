import React from 'react';
import { PanelProps, GraphWithLegend, LegendTable, LegendList } from '@grafana/ui';
import { Options } from './types';
import { getGraphSeriesModel } from './getGraphSeriesModel';

export class GraphPanel extends React.Component<PanelProps<Options>> {
  render() {
    const { data, timeRange, width, height, options } = this.props;
    if (!data) {
      return (
        <div className="panel-empty">
          <p>No data found in response</p>
        </div>
      );
    }

    const { showLines, showBars, showPoints, legend: legendOptions } = options;

    const graphProps = {
      showBars,
      showLines,
      showPoints,
    };
    const { asTable, isVisible, ...legendProps } = legendOptions;

    return (
      <GraphWithLegend
        series={getGraphSeriesModel(data, legendOptions.stats)}
        timeRange={timeRange}
        width={width}
        height={height}
        renderLegendAs={asTable ? LegendTable : LegendList}
        isLegendVisible={isVisible}
        {...graphProps}
        {...legendProps}
      />
    );
  }
}
