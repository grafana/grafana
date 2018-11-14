import React, { PureComponent } from 'react';
import Gauge from 'app/viz/Gauge';
import { NullValueMode, PanelOptionsProps, PanelProps } from 'app/types';
import { getTimeSeriesVMs } from 'app/viz/state/timeSeries';
import { UnitPicker } from '../../../core/components/Picker/UnitPicker';

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

export class GaugeOptions extends PureComponent<PanelOptionsProps<Options>> {
  render() {
    return (
      <div>
        <div className="section gf-form-group">
          <h5 className="page-heading">Units</h5>
          <UnitPicker onSelected={() => {}} />
        </div>
      </div>
    );
  }
}

export { GaugePanel as PanelComponent, GaugeOptions as PanelOptionsComponent };
