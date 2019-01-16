import React, { PureComponent } from 'react';
import { PanelProps, NullValueMode } from '@grafana/ui';

import { getTimeSeriesVMs } from 'app/viz/state/timeSeries';
import Gauge from 'app/viz/Gauge';
import { GaugeOptions } from './types';

interface Props extends PanelProps<GaugeOptions> {}

export class GaugePanel extends PureComponent<Props> {
  render() {
    const { timeSeries, width, height, onInterpolate, options } = this.props;

    const prefix = onInterpolate(options.prefix);
    const suffix = onInterpolate(options.suffix);

    const vmSeries = getTimeSeriesVMs({
      timeSeries: timeSeries,
      nullValueMode: NullValueMode.Ignore,
    });

    return (
      <Gauge
        timeSeries={vmSeries}
        {...this.props.options}
        width={width}
        height={height}
        prefix={prefix}
        suffix={suffix}
      />
    );
  }
}
