// Libraries
import _ from 'lodash';
import React, { PureComponent } from 'react';

import {
  Graph,
  PanelProps,
  NullValueMode,
  colors,
  TimeSeriesVMs,
  ColumnType,
  guessColumnTypes,
  getFirstTimeColumn,
  processTimeSeries,
} from '@grafana/ui';
import { Options } from './types';

interface Props extends PanelProps<Options> {}

export class GraphPanel extends PureComponent<Props> {
  render() {
    const { data, timeRange, width, height } = this.props;
    const { showLines, showBars, showPoints } = this.props.options;

    const vmSeries: TimeSeriesVMs = [];
    for (let t = 0; t < data.length; t++) {
      const table = guessColumnTypes(data[t]);
      const timeColumn = getFirstTimeColumn(table);
      if (timeColumn >= 0) {
        for (let i = 0; i < table.columns.length; i++) {
          const column = table.columns[i];

          // Show all numeric columns
          if (column.type === ColumnType.number) {
            const tsvm = processTimeSeries({
              data: [table],
              xColumn: timeColumn,
              yColumn: i,
              nullValueMode: NullValueMode.Null,
            })[0];

            const colorIndex = vmSeries.length % colors.length;
            tsvm.color = colors[colorIndex];
            vmSeries.push(tsvm);
          }
        }
      }
    }

    return (
      <Graph
        timeSeries={vmSeries}
        timeRange={timeRange}
        showLines={showLines}
        showPoints={showPoints}
        showBars={showBars}
        width={width}
        height={height}
      />
    );
  }
}
