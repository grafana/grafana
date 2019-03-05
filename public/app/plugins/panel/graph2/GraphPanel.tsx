// Libraries
import _ from 'lodash';
import React, { PureComponent } from 'react';

// Utils
import { processTimeSeriesFromData } from '@grafana/ui/src/utils/processData';

// Components
import { Graph } from '@grafana/ui';

// Types
import { PanelProps, TimeSeriesVMs, NullValueMode } from '@grafana/ui/src/types';
import { Options } from './types';

interface Props extends PanelProps<Options> {}

export class GraphPanel extends PureComponent<Props> {
  render() {
    const { panelData, timeRange, width, height } = this.props;
    const { showLines, showBars, showPoints } = this.props.options;

    let vmSeries: TimeSeriesVMs;
    if (panelData.data) {
      vmSeries = processTimeSeriesFromData({
        dataModels: panelData.data,
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
