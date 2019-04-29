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

    if (!data.series.length) {
      return <div>No Table Data...</div>;
    }

    if (showToolbar) {
      return <Tables {...this.props} {...options} theme={config.theme} data={data.series} />;
    }

    return <Table {...this.props} {...options} theme={config.theme} data={data.series[0]} />;
  }
}
