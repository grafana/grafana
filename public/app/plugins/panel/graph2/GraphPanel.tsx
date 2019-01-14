// Libraries
import _ from 'lodash';
import React, { PureComponent } from 'react';
import { colors } from '@grafana/ui';

// Utils
import { processTimeSeries } from '@grafana/ui/src/utils';

// Components
import { Graph } from '@grafana/ui';

// Types
import { PanelProps, NullValueMode } from '@grafana/ui/src/types';
import { Options } from './types';

interface Props extends PanelProps<Options> {}

export class GraphPanel extends PureComponent<Props> {
  render() {
    const { timeSeries, timeRange, width, height } = this.props;
    const { showLines, showBars, showPoints } = this.props.options;

    const vmSeries = processTimeSeries({
      timeSeries: timeSeries,
      nullValueMode: NullValueMode.Ignore,
      colorPalette: colors,
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
