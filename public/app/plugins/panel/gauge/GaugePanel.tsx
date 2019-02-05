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
    console.log('renduru');
    const { panelData, width, height, onInterpolate, options } = this.props;

    const prefix = onInterpolate(options.prefix);
    const suffix = onInterpolate(options.suffix);
    let value: TimeSeriesValue;

    if (panelData.timeSeries) {
      const vmSeries = processTimeSeries({
        timeSeries: panelData.timeSeries,
        nullValueMode: NullValueMode.Null,
      });

      const gauges = [];
      if (vmSeries.length > 1) {
        for (let i = 0; i < vmSeries.length; i++) {
          gauges.push(
            <ThemeProvider key={`gauge-${i}`}>
              {theme => (
                <div
                  className="singlestat-panel"
                  style={{ display: 'inline-block', width: `${Math.floor(1 / vmSeries.length * 100)}%` }}
                >
                  <Gauge
                    value={vmSeries[i].stats[options.stat]}
                    {...this.props.options}
                    width={Math.floor(width / vmSeries.length) - 10}
                    height={height}
                    prefix={prefix}
                    suffix={suffix}
                    theme={theme}
                  />
                  <div style={{ textAlign: 'center' }}>Gauge {i}</div>
                </div>
              )}
            </ThemeProvider>
          );
        }
        return [gauges];
      } else if (vmSeries.length > 0) {
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
          <div className="singlestat-panel">
            <Gauge
              value={value}
              {...this.props.options}
              width={width}
              height={height}
              prefix={prefix}
              suffix={suffix}
              theme={theme}
            />
          </div>
        )}
      </ThemeProvider>
    );
  }
}
