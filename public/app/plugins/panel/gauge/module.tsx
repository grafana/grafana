import React, { PureComponent } from 'react';
import Gauge from 'app/viz/Gauge';
import { getTimeSeriesVMs } from 'app/viz/state/timeSeries';
import ValueOptions from './ValueOptions';
import GaugeOptions from './GaugeOptions';
import Thresholds from './Thresholds';
import ValueMappings from './ValueMappings';
import {
  BasicGaugeColor,
  NullValueMode,
  PanelOptionsProps,
  PanelProps,
  RangeMap,
  Threshold,
  ValueMap,
} from 'app/types';

export interface OptionsProps {
  decimals: number;
  prefix: string;
  showThresholdLabels: boolean;
  showThresholdMarkers: boolean;
  stat: string;
  suffix: string;
  unit: string;
  thresholds: Threshold[];
  mappings: Array<RangeMap | ValueMap>;
}

export interface OptionModuleProps {
  onChange: (item: any) => void;
  options: OptionsProps;
}

export const defaultProps = {
  options: {
    minValue: 0,
    maxValue: 100,
    prefix: '',
    showThresholdMarkers: true,
    showThresholdLabels: false,
    suffix: '',
    decimals: 0,
    stat: '',
    unit: '',
    mappings: [],
    thresholds: [
      { index: 0, label: 'Min', value: 0, canRemove: false, color: BasicGaugeColor.Green },
      { index: 1, label: 'Max', value: 100, canRemove: false },
    ],
  },
};

interface Props extends PanelProps<OptionsProps> {}

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

class Options extends PureComponent<PanelOptionsProps<OptionsProps>> {
  static defaultProps = defaultProps;

  render() {
    const { onChange, options } = this.props;
    return (
      <div>
        <div className="form-section">
          <ValueOptions onChange={onChange} options={options} />
          <GaugeOptions onChange={onChange} options={options} />
          <Thresholds onChange={onChange} options={options} />
        </div>
        <div className="form-section">
          <ValueMappings onChange={onChange} options={options} />
        </div>
      </div>
    );
  }
}

export { GaugePanel as Panel, Options as PanelOptions, defaultProps as PanelDefaults };
