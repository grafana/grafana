import React, { PureComponent } from 'react';
import Gauge from 'app/viz/Gauge';
import { NullValueMode, PanelOptionsProps, PanelProps, Threshold } from 'app/types';
import { getTimeSeriesVMs } from 'app/viz/state/timeSeries';
import ValueOptions from './ValueOptions';
import GaugeOptions from './GaugeOptions';
import Thresholds from './Thresholds';

export interface OptionsProps {
  decimals: number;
  prefix: string;
  showThresholdLabels: boolean;
  showThresholdMarkers: boolean;
  stat: string;
  suffix: string;
  unit: string;
  thresholds: Threshold[];
}

export const defaultProps = {
  options: {
    minValue: 0,
    maxValue: 100,
    prefix: '',
    showThresholdMarkers: true,
    showThresholdLabels: false,
    suffix: '',
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
    return (
      <div>
        <ValueOptions onChange={this.props.onChange} options={this.props.options} />
        <GaugeOptions onChange={this.props.onChange} options={this.props.options} />
        <Thresholds onChange={this.props.onChange} options={this.props.options} />
      </div>
    );
  }
}

export { GaugePanel as Panel, Options as PanelOptions, defaultProps as PanelDefaults };
