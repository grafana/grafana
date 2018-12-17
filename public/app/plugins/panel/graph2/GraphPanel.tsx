// Libraries
import _ from 'lodash';
import React, { PureComponent } from 'react';

// Components
import Graph from 'app/viz/Graph';

// Services & Utils
import { getTimeSeriesVMs } from 'app/viz/state/timeSeries';

// Types
import { PanelProps, NullValueMode } from 'app/types';
import { Options } from './types';

interface Props extends PanelProps<Options> {}

export class GraphPanel extends PureComponent<Props> {
  constructor(props) {
    super(props);
  }

  render() {
    const { timeSeries, timeRange, width, height } = this.props;
    const { showLines, showBars, showPoints } = this.props.options;

    const vmSeries = getTimeSeriesVMs({
      timeSeries: timeSeries,
      nullValueMode: NullValueMode.Ignore,
    });

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
