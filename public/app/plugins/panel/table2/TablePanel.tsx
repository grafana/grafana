// Libraries
import _ from 'lodash';
import React, { Component } from 'react';

// Types
import { PanelProps, ThemeContext } from '@grafana/ui';
import { Options } from './types';
import DataTable from '@grafana/ui/src/components/DataTable/DataTable';

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
        {theme => <DataTable {...this.props} {...options} theme={theme} data={panelData.tableData} />}
      </ThemeContext.Consumer>
    );
  }
}
