import React, { PureComponent } from 'react';
import Gauge from 'app/viz/Gauge';
import { NullValueMode, PanelProps } from 'app/types';
import { getTimeSeriesVMs } from 'app/viz/state/timeSeries';
import { GaugeOptions } from './GaugeOptions';

export interface Options {}

interface Props extends PanelProps<Options> {}

export class GaugePanel extends PureComponent<Props> {
  render() {
    const { timeSeries, width, height } = this.props;

    const vmSeries = getTimeSeriesVMs({
      timeSeries: timeSeries,
      nullValueMode: NullValueMode.Ignore,
    });

    return (
      <Gauge maxValue={100} minValue={0} timeSeries={vmSeries} thresholds={[0, 100]} height={height} width={width} />
    );
  }
}

export { GaugePanel as Panel, GaugeOptions as PanelOptions };
