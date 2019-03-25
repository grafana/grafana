// Libraries
import _ from 'lodash';
import React, { PureComponent } from 'react';

import { Graph, PanelProps, NullValueMode, colors, Trace, FieldType, getFirstTimeField } from '@grafana/ui';
import { Options } from './types';
import { getFlotPairs } from '@grafana/ui/src/utils/flotPairs';

interface Props extends PanelProps<Options> {}

export class GraphPanel extends PureComponent<Props> {
  render() {
    const { data, timeRange, width, height } = this.props;
    const { showLines, showBars, showPoints } = this.props.options;

    const traces: Trace[] = [];
    for (const table of data) {
      const timeColumn = getFirstTimeField(table);
      if (timeColumn < 0) {
        continue;
      }

      for (let i = 0; i < table.fields.length; i++) {
        const column = table.fields[i];

        // Show all numeric columns
        if (column.type === FieldType.number) {
          // Use external calculator just to make sure it works :)
          const points = getFlotPairs({
            rows: table.rows,
            xIndex: timeColumn,
            yIndex: i,
            nullValueMode: NullValueMode.Null,
          });

          if (points.length > 0) {
            traces.push({
              label: column.name,
              data: points,
              color: colors[traces.length % colors.length],
            });
          }
        }
      }
    }

    return (
      <Graph
        traces={traces}
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
