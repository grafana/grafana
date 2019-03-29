// Libraries
import _ from 'lodash';
import React, { PureComponent } from 'react';

import { Graph, PanelProps, NullValueMode, colors, GraphSeriesXY, FieldType, getFirstTimeField } from '@grafana/ui';
import { Options } from './types';
import { getFlotPairs } from '@grafana/ui/src/utils/flotPairs';

interface Props extends PanelProps<Options> {}

export class GraphPanel extends PureComponent<Props> {
  render() {
    const { data, timeRange, width, height } = this.props;
    const { showLines, showBars, showPoints } = this.props.options;

    const graphs: GraphSeriesXY[] = [];
    if (data) {
      for (const series of data) {
        const timeColumn = getFirstTimeField(series);
        if (timeColumn < 0) {
          continue;
        }

        for (let i = 0; i < series.fields.length; i++) {
          const field = series.fields[i];

          // Show all numeric columns
          if (field.type === FieldType.number) {
            // Use external calculator just to make sure it works :)
            const points = getFlotPairs({
              series,
              xIndex: timeColumn,
              yIndex: i,
              nullValueMode: NullValueMode.Null,
            });

            if (points.length > 0) {
              graphs.push({
                label: field.name,
                data: points,
                color: colors[graphs.length % colors.length],
              });
            }
          }
        }
      }
    }

    if (graphs.length < 1) {
      return (
        <div className="panel-empty">
          <p>No data found in response</p>
        </div>
      );
    }

    return (
      <Graph
        series={graphs}
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
