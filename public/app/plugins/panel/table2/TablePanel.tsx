// Libraries
import React, { Component } from 'react';

// Types
import { Table } from '@grafana/ui';
import { PanelProps, applyFieldOverrides } from '@grafana/data';
import { Options } from './types';
import { config } from 'app/core/config';
import { tableFieldRegistry } from './custom';

interface Props extends PanelProps<Options> {}

const paddingBottom = 16;

export class TablePanel extends Component<Props> {
  constructor(props: Props) {
    super(props);
  }

  render() {
    const { data, height, width, replaceVariables, options } = this.props;

    if (data.series.length < 1) {
      return <div>No Table Data...</div>;
    }

    const dataProcessed = applyFieldOverrides({
      data: data.series,
      fieldOptions: options.fieldOptions,
      theme: config.theme,
      replaceVariables,
      custom: tableFieldRegistry,
    })[0];

    return <Table height={height - paddingBottom} width={width} data={dataProcessed} />;
  }
}
