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
    const { panelData, options } = this.props;
    const { showToolbar } = options;

    if (!panelData || !panelData.tableData) {
      return <div>No Table Data...</div>;
    }

    if (showToolbar) {
      const tables = [panelData.tableData];
      return <Tables {...this.props} {...options} theme={config.theme} data={tables} />;
    }

    return <Table {...this.props} {...options} theme={config.theme} data={panelData.tableData} />;
  }
}
