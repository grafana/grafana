import React, { PureComponent } from 'react';
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
    const { data } = this.props;
    let value = 0;

    if (data.length) {
      value = data[0].value;
    }

    console.log('graph2 render');

    return <h2>Text Panel {value}</h2>;
  }
}

export class TextOptions extends PureComponent<any> {
  render() {
    return <p>Text2 Options component</p>;
  }
}

export { Graph2 as PanelComponent, TextOptions as PanelOptions };
