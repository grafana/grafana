// Libraries
import _ from 'lodash';
import React, { PureComponent } from 'react';

// Components
import { Graph } from 'app/viz/Graph';

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
    const { timeSeries } = this.props;
    let index = 0;

    return <Graph timeSeries={timeSeries} />;
  }
}

export class TextOptions extends PureComponent<any> {
  render() {
    return <p>Text2 Options component</p>;
  }
}

export { Graph2 as PanelComponent, TextOptions as PanelOptions };
