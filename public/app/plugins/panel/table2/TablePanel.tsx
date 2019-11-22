// Libraries
import React, { Component } from 'react';

// Types
import { getTheme, Table } from '@grafana/ui';
import { PanelProps, getFieldProperties, getDisplayProcessor, FieldType, reduceField, ReducerID } from '@grafana/data';
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
        const stats = reduceField({ field: f, reducers: [ReducerID.min, ReducerID.max, ReducerID.mean] });
        const min = stats[ReducerID.min];
        const max = stats[ReducerID.max];
        const delta = max - min;

        const config = getFieldProperties(defaults, f.config || {}, override);
        const d = getDisplayProcessor({
          config,
          theme,
          type: f.type,
        });
        const display = (value: any) => {
          const v = d(value);
          const percent = (v.numeric - min) / delta;
          if (percent > 0.8) {
            v.color = '#F0F';
          } else {
            v.color = undefined; // nothing
          }
          v.text += ' ' + percent;
          return v;
        };
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
