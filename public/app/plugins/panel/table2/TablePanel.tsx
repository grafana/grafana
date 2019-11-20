// Libraries
import React, { Component } from 'react';

// Types
import { getTheme, Table } from '@grafana/ui';
import { PanelProps, getFieldProperties, getDisplayProcessor, FieldType } from '@grafana/data';
import { TablePanelOptions } from './types';

interface Props extends PanelProps<TablePanelOptions> {}

export class TablePanel extends Component<Props> {
  constructor(props: Props) {
    super(props);
  }

  render() {
    const { data, options } = this.props;
    const { defaults, override } = options.fieldOptions;

    if (data.series.length < 1) {
      return <div>No Table Data...</div>;
    }

    const theme = getTheme();
    const fields = data.series[0].fields.map(f => {
      if (f.type === FieldType.number) {
        const config = getFieldProperties(defaults, f.config || {}, override);
        const display = getDisplayProcessor({
          config,
          theme,
          type: f.type,
        });
        return {
          ...f,
          config,
          display,
        };
      }
      return f;
    });

    const frame = {
      ...data.series[0],
      fields,
    };

    return <Table {...this.props} {...options} theme={theme} data={frame} />;
  }
}
