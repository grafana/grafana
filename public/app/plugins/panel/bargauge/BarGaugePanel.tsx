// Libraries
import React, { PureComponent } from 'react';

// Services & Utils
import { processTimeSeries, ThemeContext } from '@grafana/ui';

// Components
import { BarGauge } from '@grafana/ui';

// Types
import { BarGaugeOptions } from './types';
import { PanelProps, NullValueMode, TimeSeriesValue } from '@grafana/ui/src/types';

interface Props extends PanelProps<BarGaugeOptions> {}

export class BarGaugePanel extends PureComponent<Props> {
  render() {
    const { panelData, width, height, onInterpolate, options } = this.props;

    const prefix = onInterpolate(options.prefix);
    const suffix = onInterpolate(options.suffix);

    let value: TimeSeriesValue;

    if (panelData.timeSeries) {
      const vmSeries = processTimeSeries({
        timeSeries: panelData.timeSeries,
        nullValueMode: NullValueMode.Null,
      });

      if (vmSeries[0]) {
        value = vmSeries[0].stats[options.stat];
      } else {
        value = null;
      }
    } else if (panelData.tableData) {
      value = panelData.tableData.rows[0].find(prop => prop > 0);
    }

    return (
      <ThemeContext.Consumer>
        {theme => (
          <BarGauge
            value={value}
            {...this.props.options}
            width={width}
            height={height}
            prefix={prefix}
            suffix={suffix}
            theme={theme}
          />
        )}
      </ThemeContext.Consumer>
    );
  }
}
