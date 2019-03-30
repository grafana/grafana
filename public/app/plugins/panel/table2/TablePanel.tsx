// Libraries
import React, { Component } from 'react';

// Types
import { PanelProps } from '@grafana/ui';
import { Options } from './types';
import { Table, Tables } from '@grafana/ui';
import { config } from 'app/core/config';

interface Props extends PanelProps<Options> {}

export class TablePanel extends Component<Props> {
  constructor(props: Props) {
    super(props);
  }

  render() {
    const { data, options } = this.props;
    const { showToolbar } = options;

    if (data.length < 1) {
      return <div>No Table Data...</div>;
    }

    if (showToolbar) {
      return <Tables {...this.props} {...options} theme={config.theme} data={data} />;
    }

    return <Table {...this.props} {...options} theme={config.theme} data={data[0]} />;
  }
}
