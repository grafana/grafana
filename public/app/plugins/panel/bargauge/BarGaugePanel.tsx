// Libraries
import React from 'react';

// Services & Utils
import { DisplayValue, VizOrientation } from '@grafana/ui';
import { config } from 'app/core/config';

// Components
import { BarGauge } from '@grafana/ui';

// Types
import { BarGaugeOptions } from './types';
import { SingleStatPanel } from '../gauge/SingleStatPanel';

export class BarGaugePanel extends SingleStatPanel<BarGaugeOptions> {
  getOrientation(): VizOrientation {
    const { options } = this.props;
    return options.orientation;
  }

  renderStat(value: DisplayValue, width: number, height: number) {
    const { options } = this.props;
    const { display } = options;

    return (
      <BarGauge
        value={value}
        width={width}
        height={height}
        orientation={options.orientation}
        thresholds={display.thresholds}
        theme={config.theme}
      />
    );
  }
}
