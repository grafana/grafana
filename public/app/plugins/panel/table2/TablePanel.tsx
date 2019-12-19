// Libraries
import React, { Component } from 'react';

// Types
import { Table } from '@grafana/ui';
import { PanelProps } from '@grafana/data';
import { Options } from './types';

interface Props extends PanelProps<Options> {}

// So that the table does not go all the way to the edge of the panel chrome
const paddingBottom = 35;

export class TablePanel extends Component<Props> {
  constructor(props: Props) {
    super(props);
  }

  render() {
    const { data, height, width } = this.props;

    if (data.series.length < 1) {
      return <div>No Table Data...</div>;
    }

    return <Table height={height - paddingBottom} width={width} data={data.series[0]} />;
  }
}
