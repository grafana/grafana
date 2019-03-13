// Libraries
import React, { Component } from 'react';

// Types
import { PanelProps, ThemeContext } from '@grafana/ui';
import { Options } from './types';
import Table from '@grafana/ui/src/components/Table/Table';

interface Props extends PanelProps<Options> {}

export class TablePanel extends Component<Props> {
  constructor(props: Props) {
    super(props);
  }

  render() {
    const { panelData, options } = this.props;

    if (!panelData || !panelData.tableData) {
      return <div>No Table Data...</div>;
    }

    return (
      <ThemeContext.Consumer>
        {theme => <Table {...this.props} {...options} theme={theme} data={panelData.tableData} />}
      </ThemeContext.Consumer>
    );
  }
}
