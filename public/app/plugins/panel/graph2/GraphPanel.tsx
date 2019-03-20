// Libraries
import _ from 'lodash';
import React, { PureComponent } from 'react';

// Utils
import { processTimeSeries } from '@grafana/ui/src/utils';

// Components
import { Graph } from '@grafana/ui';

// Types
import { PanelProps, NullValueMode, TimeSeriesVMs } from '@grafana/ui/src/types';
import { Options } from './types';

interface Props extends PanelProps<Options> {}

export class GraphPanel extends PureComponent<Props> {
  render() {
    const { data, timeRange, width, height } = this.props;
    const { showLines, showBars, showPoints } = this.props.options;

    let vmSeries: TimeSeriesVMs;
    if (data) {
      vmSeries = processTimeSeries({
        data,
        nullValueMode: NullValueMode.Ignore,
      });
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
