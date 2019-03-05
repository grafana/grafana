// Libraries
import React, { PureComponent } from 'react';

// Services & Utils
import { processTimeSeries, ThemeContext } from '@grafana/ui';

// Components
import { Gauge } from '@grafana/ui';

// Types
import { GaugeOptions } from './types';
import { PanelProps, NullValueMode, TimeSeriesValue } from '@grafana/ui/src/types';

interface Props extends PanelProps<GaugeOptions> {}

export class GaugePanel extends PureComponent<Props> {
  render() {
    const { panelData, width, height, replaceVariables, options } = this.props;
    const { valueOptions } = options;

    const prefix = replaceVariables(valueOptions.prefix);
    const suffix = replaceVariables(valueOptions.suffix);
    let value: TimeSeriesValue;

    if (panelData.timeSeries) {
      const vmSeries = processTimeSeries({
        timeSeries: panelData.timeSeries,
        nullValueMode: NullValueMode.Null,
      });

      if (vmSeries[0]) {
        value = vmSeries[0].stats[valueOptions.stat];
      } else {
        value = null;
      }
    } else if (panelData.tableData) {
      value = panelData.tableData.rows[0].find(prop => prop > 0);
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
