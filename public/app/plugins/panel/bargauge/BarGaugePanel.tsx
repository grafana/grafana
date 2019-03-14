// Libraries
import React from 'react';

// Services & Utils
import { DisplayValue } from '@grafana/ui';
import { config } from 'app/core/config';

// Components
import { BarGauge } from '@grafana/ui';

// Types
import { BarGaugeOptions } from './types';
import { SingleStatBase } from '../singlestat2/SingleStatBase';

export class BarGaugePanel extends SingleStatBase<BarGaugeOptions> {
  renderStat(value: DisplayValue, width: number, height: number) {
    const { options } = this.props;

    return (
      <BarGauge
        value={value}
        width={width}
        height={height}
        orientation={options.orientation}
        thresholds={options.thresholds}
        theme={config.theme}
      />
    );
  }
}
