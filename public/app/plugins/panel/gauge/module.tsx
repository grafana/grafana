import React, { PureComponent } from 'react';
import Gauge from 'app/viz/Gauge';
import { NullValueMode, PanelProps } from 'app/types';
import { getTimeSeriesVMs } from 'app/viz/state/timeSeries';

export interface Options {}

interface Props extends PanelProps<Options> {}

export class GaugePanel extends PureComponent<Props> {
  render() {
    const { timeSeries } = this.props;

    const vmSeries = getTimeSeriesVMs({
      timeSeries: timeSeries,
      nullValueMode: NullValueMode.Ignore,
    });

    return <Gauge maxValue={100} minValue={0} timeSeries={vmSeries} thresholds={[0, 100]} />;
  }
}

export { GaugePanel as PanelComponent };
