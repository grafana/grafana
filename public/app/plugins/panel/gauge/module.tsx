import React, { PureComponent } from 'react';
import Gauge from 'app/viz/Gauge';
import Options, { OptionsProps } from './Options';
import { NullValueMode, PanelProps } from 'app/types';
import { getTimeSeriesVMs } from 'app/viz/state/timeSeries';

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

export { GaugePanel as Panel, Options as PanelOptions };
