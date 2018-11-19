import React, { PureComponent } from 'react';
import { Label } from 'app/core/components/Label/Label';
import SimplePicker from 'app/core/components/Picker/SimplePicker';
import UnitPicker from 'app/core/components/Picker/Unit/UnitPicker';
import Gauge from 'app/viz/Gauge';
import { NullValueMode, PanelOptionsProps, PanelProps } from 'app/types';
import { getTimeSeriesVMs } from 'app/viz/state/timeSeries';

export interface Options {
  stat: { value: string; text: string };
  unit: { label: string; value: string };
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
  onUnitChange = value => {
    this.props.onChange({ ...this.props.options, unit: value });
  };

  onStatChange = value => {
    this.props.onChange({ ...this.props.options, stat: value });
  };

  render() {
    return (
      <div>
        <div className="section gf-form-group">
          <h5 className="page-heading">Value</h5>
          <div className="gf-form-inline">
            <Label width={5}>Stat</Label>
            <SimplePicker
              defaultValue={statOptions.find(option => option.value === this.props.options.stat.value)}
              width={11}
              options={statOptions}
              getOptionLabel={i => i.text}
              getOptionValue={i => i.value}
              onSelected={this.onStatChange}
              value={this.props.options.stat}
            />
          </div>
          <div className="gf-form-inline">
            <Label width={5}>Unit</Label>
            <UnitPicker defaultValue={this.props.options.unit.value} onSelected={value => this.onUnitChange(value)} />
          </div>
        </div>
      </div>
    );
  }
}

export { GaugePanel as Panel, GaugeOptions as PanelOptions };
