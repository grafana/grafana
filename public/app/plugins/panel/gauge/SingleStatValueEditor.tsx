// Libraries
import React, { PureComponent } from 'react';

// Components
import { FormLabel, PanelOptionsGroup, Select } from '@grafana/ui';

// Types
import { GaugeOptions } from './types';

const statOptions = [
  { value: 'min', label: 'Min' },
  { value: 'max', label: 'Max' },
  { value: 'avg', label: 'Average' },
  { value: 'current', label: 'Current' },
  { value: 'total', label: 'Total' },
  { value: 'name', label: 'Name' },
  { value: 'first', label: 'First' },
  { value: 'delta', label: 'Delta' },
  { value: 'diff', label: 'Difference' },
  { value: 'range', label: 'Range' },
  { value: 'last_time', label: 'Time of last point' },
];

const labelWidth = 6;

export interface Props {
  options: GaugeOptions;
  onChange: (options: GaugeOptions) => void;
}

export class SingleStatValueEditor extends PureComponent<Props> {
  onStatChange = stat => this.props.onChange({ ...this.props.options, stat: stat.value });

  render() {
    const { stat } = this.props.options;

    return (
      <PanelOptionsGroup title="Show Value">
        <div className="gf-form">
          <FormLabel width={labelWidth}>Stat</FormLabel>
          <Select
            width={12}
            options={statOptions}
            onChange={this.onStatChange}
            value={statOptions.find(option => option.value === stat)}
          />
        </div>
      </PanelOptionsGroup>
    );
  }
}
