import React, { Component } from 'react';

import coreModule from 'app/core/core_module';

import { TableInputCSV, SeriesData, toCSV } from '@grafana/ui';

interface Props {
  data: SeriesData[];
  onParsed: (data: SeriesData[]) => void;
}

interface State {
  data: SeriesData[];
  text: string;
}

/**
 * Angular wrapper around TableInputCSV
 */
class Wraper extends Component<Props, State> {
  constructor(props) {
    super(props);
    this.state = {
      text: toCSV(props.data),
      data: props.data,
    };
  }

  onSeriesParsed = (data: SeriesData[], text: string) => {
    this.setState({ data, text });
    this.props.onParsed(data);
  };

  render() {
    const { text } = this.state;
    return <TableInputCSV text={text} onSeriesParsed={this.onSeriesParsed} width={'100%'} height={300} />;
  }
}

coreModule.directive('csvInput', [
  'reactDirective',
  reactDirective => {
    return reactDirective(Wraper, ['data', 'onParsed']);
  },
]);
