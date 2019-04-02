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
    const { data, options } = this.props;

    if (data.length < 1) {
      return <div>No Table Data...</div>;
    }

    return (
      <ThemeContext.Consumer>
        {theme => <Table {...this.props} {...options} theme={theme} data={data[0]} />}
      </ThemeContext.Consumer>
    );
  }
}
