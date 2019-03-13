// Libraries
import React from 'react';

// Services & Utils
import { PanelProps } from '@grafana/ui';
import { config } from 'app/core/config';

// Components
import { Gauge } from '@grafana/ui';

// Types
import { GaugeOptions } from './types';
import { DisplayValue } from '@grafana/ui/src/utils/displayValue';
import { SingleStatPanel } from './SingleStatPanel';

export class GaugePanel extends SingleStatPanel<GaugeOptions> {
  constructor(props: PanelProps<GaugeOptions>) {
    super(props);

    // if (props.options.valueOptions) {
    //   console.warn('TODO!! how do we best migration options?');
    // }
  }

  renderStat(value: DisplayValue, width: number, height: number) {
    const { options } = this.props;
    const { display } = options;

    return (
      <Gauge
        value={value}
        width={width}
        height={height}
        thresholds={display.thresholds}
        showThresholdLabels={options.showThresholdLabels}
        showThresholdMarkers={options.showThresholdMarkers}
        minValue={options.minValue}
        maxValue={options.maxValue}
        theme={config.theme}
      />
    );
  }
}
