import React, { PureComponent } from 'react';
import { GaugeOptions, PanelProps, NullValueMode } from '@grafana/ui';

import { getTimeSeriesVMs } from 'app/viz/state/timeSeries';
import Gauge from 'app/viz/Gauge';

interface Props extends PanelProps<GaugeOptions> {}

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
