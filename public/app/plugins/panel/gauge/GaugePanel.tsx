// Libraries
import React, { PureComponent } from 'react';

// Services & Utils
import { ThemeContext } from '@grafana/ui';

// Components
import { Gauge } from '@grafana/ui';

// Types
import { GaugeOptions } from './types';
import { PanelProps, TimeSeriesValue } from '@grafana/ui/src/types';
import { calculateSimpleStats } from '@grafana/ui/src/utils/processData';

interface Props extends PanelProps<GaugeOptions> {}

export class GaugePanel extends PureComponent<Props> {
  calculateStats(): TimeSeriesValue[] {
    const { panelData, options } = this.props;
    const { valueOptions } = options;

    // For now assume we are always looking at the first value
    const dimension = 0;

    return panelData.data.map((data, index) => {
      const stats = calculateSimpleStats(data, dimension);
      return stats[valueOptions.stat];
    });
  }

  render() {
    const { width, height, replaceVariables, options } = this.props;
    const { valueOptions } = options;

    const prefix = replaceVariables(valueOptions.prefix);
    const suffix = replaceVariables(valueOptions.suffix);
    let value: TimeSeriesValue;

    const stats = this.calculateStats();
    if (stats.length > 0) {
      value = stats[valueOptions.stat];
    }

    return (
      <ThemeContext.Consumer>
        {theme => (
          <Gauge
            value={value}
            width={width}
            height={height}
            prefix={prefix}
            suffix={suffix}
            unit={valueOptions.unit}
            decimals={valueOptions.decimals}
            thresholds={options.thresholds}
            valueMappings={options.valueMappings}
            showThresholdLabels={options.showThresholdLabels}
            showThresholdMarkers={options.showThresholdMarkers}
            minValue={options.minValue}
            maxValue={options.maxValue}
            theme={theme}
          />
        )}
      </ThemeContext.Consumer>
    );
  }
}
