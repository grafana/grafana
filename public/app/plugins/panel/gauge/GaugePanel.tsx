// Libraries
import React, { PureComponent } from 'react';

// Services & Utils
import { processTimeSeries } from '@grafana/ui';

// Components
import { Gauge } from '@grafana/ui';

// Types
import { GaugeOptions } from './types';
import { PanelProps, NullValueMode, TimeSeriesValue } from '@grafana/ui/src/types';
import { ThemeProvider } from 'app/core/utils/ConfigProvider';

interface Props extends PanelProps<GaugeOptions> {}

export class GaugePanel extends PureComponent<Props> {
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
      <ThemeProvider>
        {theme => (
          <Gauge
            value={value}
            {...this.props.options}
            width={width}
            height={height}
            prefix={prefix}
            suffix={suffix}
            theme={theme}
          />
        )}
      </ThemeProvider>
    );
  }
}
