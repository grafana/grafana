import React, { PureComponent } from 'react';
import { Label } from 'app/core/components/Label/Label';
import SimplePicker from 'app/core/components/Picker/SimplePicker';
import UnitPicker from 'app/core/components/Picker/Unit/UnitPicker';
import Gauge from 'app/viz/Gauge';
import { NullValueMode, PanelOptionsProps, PanelProps } from 'app/types';
import { getTimeSeriesVMs } from 'app/viz/state/timeSeries';

export interface Options {
  decimals: number;
  prefix: string;
  stat: string;
  sufix: string;
  unit: string;
}

interface Props extends PanelProps<Options> {}

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

class GaugePanel extends PureComponent<Props> {
  render() {
    const { timeSeries, width, height } = this.props;

    const vmSeries = getTimeSeriesVMs({
      timeSeries: timeSeries,
      nullValueMode: NullValueMode.Ignore,
    });

    return <Gauge timeSeries={vmSeries} {...this.props.options} width={width} height={height} />;
  }
}

class GaugeOptions extends PureComponent<PanelOptionsProps<Options>> {
  onUnitChange = unit => this.props.onChange({ ...this.props.options, unit: unit.value });

  onStatChange = stat => this.props.onChange({ ...this.props.options, stat: stat.value });

  onDecimalChange = event => {
    if (!isNaN(event.target.value)) {
      this.props.onChange({ ...this.props.options, decimals: event.target.value });
    }
  };

  onPrefixChange = event => this.props.onChange({ ...this.props.options, prefix: event.target.value });

  onSufixChange = event => this.props.onChange({ ...this.props.options, sufix: event.target.value });

  render() {
    const { stat, unit, decimals, prefix, sufix } = this.props.options;
    return (
      <div>
        <div className="section gf-form-group">
          <h5 className="page-heading">Value</h5>
          <div className="gf-form-inline">
            <Label width={5}>Stat</Label>
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
            <Label width={5}>Unit</Label>
            <UnitPicker defaultValue={unit} onSelected={value => this.onUnitChange(value)} />
          </div>
          <div className="gf-form-inline">
            <Label width={5}>Decimals</Label>
            <input
              className="gf-form-input width-12"
              type="number"
              placeholder="auto"
              value={decimals || ''}
              onChange={this.onDecimalChange}
            />
          </div>
          <div className="gf-form-inline">
            <Label width={5}>Prefix</Label>
            <input className="gf-form-input width-12" type="text" value={prefix || ''} onChange={this.onPrefixChange} />
          </div>
          <div className="gf-form-inline">
            <Label width={5}>Sufix</Label>
            <input className="gf-form-input width-12" type="text" value={sufix || ''} onChange={this.onSufixChange} />
          </div>
        </div>
      </div>
    );
  }
}

export { GaugePanel as Panel, GaugeOptions as PanelOptions };
