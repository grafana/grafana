// Libraries
import React, { Component } from 'react';

// Types
import { NewTable } from '@grafana/ui';
import { PanelProps } from '@grafana/data';
import { Options } from './types';

interface Props extends PanelProps<Options> {}

export class TablePanel extends Component<Props> {
  constructor(props: Props) {
    super(props);
  }

  render() {
    const { data, height, width } = this.props;

    if (data.series.length < 1) {
      return <div>No Table Data...</div>;
    }

    return <NewTable height={height} width={width} data={data.series[0]} />;
  }
}
