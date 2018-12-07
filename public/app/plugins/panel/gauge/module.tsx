import React, { PureComponent } from 'react';
import Gauge from 'app/viz/Gauge';
import { NullValueMode, PanelOptionsProps, PanelProps, RangeMap, Threshold, ValueMap } from 'app/types';
import { getTimeSeriesVMs } from 'app/viz/state/timeSeries';
import ValueOptions from './ValueOptions';
import GaugeOptions from './GaugeOptions';
import Thresholds from './Thresholds';
import ValueMappings from './ValueMappings';

export interface OptionsProps {
  decimals: number;
  prefix: string;
  showThresholdLabels: boolean;
  showThresholdMarkers: boolean;
  stat: string;
  suffix: string;
  unit: string;
  thresholds: Threshold[];
  valueMaps: ValueMap[];
  rangeMaps: RangeMap[];
  mappingType: number;
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
    valueMaps: [],
    rangeMaps: [],
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
          <div className="form-section__header">Options</div>
          <ValueOptions onChange={onChange} options={options} />
          <GaugeOptions onChange={onChange} options={options} />
          <Thresholds onChange={onChange} options={options} />
        </div>
        <div className="form-section">
          <div className="form-section__header">Value mappings</div>
          <ValueMappings onChange={onChange} options={options} />
        </div>
      </div>
    );
  }
}

export { GaugePanel as Panel, Options as PanelOptions, defaultProps as PanelDefaults };
