// Libraries
import _ from 'lodash';
import React, { Component } from 'react';
import colors from 'app/core/utils/colors';

// Components & Types
import { Graph, PanelProps, NullValueMode, processTimeSeries } from '@grafana/ui';
import { Options } from './types';

interface Props extends PanelProps<Options> {}

export class GraphPanel extends Component<Props> {
  constructor(props) {
    super(props);
  }

  render() {
    const { timeSeries, timeRange, width, height, onRenderError } = this.props;
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
        onRenderError={onRenderError}
      />
    );
  }
}
