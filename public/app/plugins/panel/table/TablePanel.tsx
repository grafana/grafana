import React, { Component } from 'react';

import { Table } from '@grafana/ui';
import { Field, FieldMatcherID, PanelProps } from '@grafana/data';
import { Options } from './types';

interface Props extends PanelProps<Options> {}

export class TablePanel extends Component<Props> {
  constructor(props: Props) {
    super(props);
  }

  onColumnResize = (field: Field, width: number) => {
    const current = this.props.fieldConfig;
    const matcherId = FieldMatcherID.byName;
    const prop = 'width';
    const overrides = current.overrides.filter(
      o => o.matcher.id !== matcherId || o.matcher.options !== field.name || o.properties[0].id !== prop
    );

    overrides.push({
      matcher: { id: matcherId, options: field.name },
      properties: [{ id: prop, value: width }],
    });

    this.props.onFieldConfigChange({
      ...current,
      overrides,
    });
  };

  render() {
    const {
      data,
      height,
      width,
      options: { showHeader, resizable },
    } = this.props;

    if (data.series.length < 1) {
      return <div>No Table Data...</div>;
    }

    return (
      <Table height={height - 16} width={width} data={data.series[0]} noHeader={!showHeader} resizable={resizable} />
    );
  }
}
