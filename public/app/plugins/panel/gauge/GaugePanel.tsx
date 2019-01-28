// Libraries
import React, { PureComponent } from 'react';

// Services & Utils
import { contextSrv } from 'app/core/core';
import { processTimeSeries } from '@grafana/ui';

// Components
import { Gauge } from '@grafana/ui';

// Types
import { GaugeOptions } from './types';
import { PanelProps, NullValueMode } from '@grafana/ui/src/types';

interface Props extends PanelProps<GaugeOptions> {}

export class GaugePanel extends PureComponent<Props> {

  render() {
    const { timeSeries, width, height, onInterpolate, options } = this.props;

    const prefix = onInterpolate(options.prefix);
    const suffix = onInterpolate(options.suffix);

    const vmSeries = processTimeSeries({
      timeSeries: timeSeries,
      nullValueMode: NullValueMode.Null,
    });

    return (
      <Gauge
        timeSeries={vmSeries}
        {...this.props.options}
        width={width}
        height={height}
        prefix={prefix}
        suffix={suffix}
        theme={contextSrv.getTheme()}
      />
    );
  }
}
