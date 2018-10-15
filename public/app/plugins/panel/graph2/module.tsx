// Libraries
import _ from 'lodash';
import React, { PureComponent } from 'react';

// Components
import Graph from 'app/viz/Graph';

// Utils
import { getTimeSeriesVMs } from 'app/viz/state/timeSeries';

// Types
import { PanelProps } from 'app/types';

interface Options {
  showBars: boolean;
}

interface Props extends PanelProps {
  options: Options;
}

export class Graph2 extends PureComponent<Props> {
  constructor(props) {
    super(props);
  }

  render() {
    const { timeSeries, timeRange } = this.props;
    const viewModels = getTimeSeriesVMs({ timeSeries });
    console.log(viewModels);

    return <Graph timeSeries={viewModels} timeRange={timeRange} />;
  }
}

export class TextOptions extends PureComponent<any> {
  render() {
    return <p>Text2 Options component</p>;
  }
}

export { Graph2 as PanelComponent, TextOptions as PanelOptions };
