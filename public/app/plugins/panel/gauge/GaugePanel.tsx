import React, { PureComponent } from 'react';
import { PanelProps, NullValueMode } from '@grafana/ui';
import { getTimeSeriesVMs } from 'app/viz/state/timeSeries';
import Gauge from 'app/viz/Gauge';
import { Options } from './types';

interface Props extends PanelProps<Options> {}

export class GaugePanel extends PureComponent<Props> {
  render() {
    const { timeSeries, width, height } = this.props;

    const vmSeries = getTimeSeriesVMs({
      timeSeries: timeSeries,
      nullValueMode: NullValueMode.Ignore,
    });

    return <Gauge timeSeries={vmSeries} {...this.props.options} width={width} height={height} />;
  }
}
