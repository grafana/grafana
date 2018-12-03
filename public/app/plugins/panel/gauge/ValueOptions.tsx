import React, { PureComponent } from 'react';
import { Label } from 'app/core/components/Label/Label';
import SimplePicker from 'app/core/components/Picker/SimplePicker';
import UnitPicker from 'app/core/components/Picker/Unit/UnitPicker';
import { OptionModuleProps } from './module';

const statOptions = [
  { value: 'min', text: 'Min' },
  { value: 'max', text: 'Max' },
  { value: 'avg', text: 'Average' },
  { value: 'current', text: 'Current' },
  { value: 'total', text: 'Total' },
  { value: 'name', text: 'Name' },
  { value: 'first', text: 'First' },
  { value: 'delta', text: 'Delta' },
  { value: 'diff', text: 'Difference' },
  { value: 'range', text: 'Range' },
  { value: 'last_time', text: 'Time of last point' },
];

const labelWidth = 6;

export default class ValueOptions extends PureComponent<OptionModuleProps> {
  onUnitChange = unit => this.props.onChange({ ...this.props.options, unit: unit.value });

  onStatChange = stat => this.props.onChange({ ...this.props.options, stat: stat.value });

  onDecimalChange = event => {
    if (!isNaN(event.target.value)) {
      this.props.onChange({ ...this.props.options, decimals: event.target.value });
    }
  };

  onPrefixChange = event => this.props.onChange({ ...this.props.options, prefix: event.target.value });

  onSuffixChange = event => this.props.onChange({ ...this.props.options, suffix: event.target.value });

  render() {
    const { stat, unit, decimals, prefix, suffix } = this.props.options;

    return (
      <div className="section gf-form-group">
        <h5 className="page-heading">Value</h5>
        <div className="gf-form-inline">
          <Label width={labelWidth}>Stat</Label>
          <SimplePicker
            width={12}
            options={statOptions}
            getOptionLabel={i => i.text}
            getOptionValue={i => i.value}
            onSelected={this.onStatChange}
            value={statOptions.find(option => option.value === stat)}
          />
        </div>
        <div className="gf-form-inline">
          <Label width={labelWidth}>Unit</Label>
          <UnitPicker defaultValue={unit} onSelected={value => this.onUnitChange(value)} />
        </div>
        <div className="gf-form-inline">
          <Label width={labelWidth}>Decimals</Label>
          <input
            className="gf-form-input width-12"
            type="number"
            placeholder="auto"
            value={decimals || ''}
            onChange={this.onDecimalChange}
          />
        </div>
        <div className="gf-form-inline">
          <Label width={labelWidth}>Prefix</Label>
          <input className="gf-form-input width-12" type="text" value={prefix || ''} onChange={this.onPrefixChange} />
        </div>
        <div className="gf-form-inline">
          <Label width={labelWidth}>Suffix</Label>
          <input className="gf-form-input width-12" type="text" value={suffix || ''} onChange={this.onSuffixChange} />
        </div>
      </div>
    );
  }
}
