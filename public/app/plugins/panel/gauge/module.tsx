import React, { PureComponent } from 'react';
import Gauge from 'app/viz/Gauge';
import { Label } from 'app/core/components/Label/Label';
import UnitPicker from 'app/core/components/Picker/Unit/UnitPicker';
import { NullValueMode, PanelOptionsProps, PanelProps } from 'app/types';
import { getTimeSeriesVMs } from 'app/viz/state/timeSeries';

export interface Options {
  unit: { label: string; value: string };
}

interface Props extends PanelProps<Options> {}

export class GaugePanel extends PureComponent<Props> {
  render() {
    const { timeSeries, width, height } = this.props;
    const { unit } = this.props.options;

    const vmSeries = getTimeSeriesVMs({
      timeSeries: timeSeries,
      nullValueMode: NullValueMode.Ignore,
    });

    return (
      <Gauge
        maxValue={100}
        minValue={0}
        timeSeries={vmSeries}
        thresholds={[0, 100]}
        height={height}
        width={width}
        unit={unit}
      />
    );
  }
}

export class GaugeOptions extends PureComponent<PanelOptionsProps<Options>> {
  onUnitChange = value => {
    this.props.onChange({ ...this.props.options, unit: value });
  };

  render() {
    return (
      <div>
        <div className="section gf-form-group">
          <h5 className="page-heading">Value</h5>
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
