// Libraries
import React, { PureComponent } from 'react';

// Services & Utils
import { processTimeSeries } from '@grafana/ui';

// Components
import { Gauge } from '@grafana/ui';

// Types
import { GaugeOptions } from './types';
import { PanelProps, NullValueMode } from '@grafana/ui/src/types';
import { ThemeProvider } from 'app/core/utils/ConfigProvider';

interface Props extends PanelProps<GaugeOptions> {}

export class GaugePanel extends PureComponent<Props> {
  renderMultipleGauge(vmSeries, theme) {
    const { options, width } = this.props;
    const gauges = [];

    for (let i = 0; i < vmSeries.length; i++) {
      const singleStatWidth = 1 / vmSeries.length * 100;
      const gaugeWidth = Math.floor(width / vmSeries.length) - 10; // make Gauge slightly smaller than panel.

      gauges.push(
        <div
          className="singlestat-panel"
          key={`gauge-${i}`}
          style={{ display: 'inline-block', width: `${singleStatWidth}%` }}
        >
          {this.renderGauge(vmSeries[i].stats[options.stat], gaugeWidth, theme)}

          <div style={{ textAlign: 'center' }}>Gauge {i}</div>
        </div>
      );
    }
    return gauges;
  }

  renderGauge(value, width, theme) {
    const { height, onInterpolate, options } = this.props;

    const prefix = onInterpolate(options.prefix);
    const suffix = onInterpolate(options.suffix);
    return (
      <Gauge value={value} {...options} width={width} height={height} prefix={prefix} suffix={suffix} theme={theme} />
    );
  }

  renderSingleGauge(timeSeries, theme) {
    const { options, width } = this.props;
    const timeSeriesValue = timeSeries[0].stats[options.stat];
    return <div className="singlestat-panel">{this.renderGauge(timeSeriesValue, width, theme)}</div>;
  }

  renderGaugeWithTableData(panelData, theme) {
    const { width } = this.props;

    const firstTableDataValue = panelData.tableData.rows[0].find(prop => prop > 0);
    return <div className="singlestat-panel">{this.renderGauge(firstTableDataValue, width, theme)}</div>;
  }

  renderPanel(theme) {
    const { panelData } = this.props;

    if (panelData.timeSeries) {
      const timeSeries = processTimeSeries({
        timeSeries: panelData.timeSeries,
        nullValueMode: NullValueMode.Null,
      });

      if (timeSeries.length > 1) {
        return this.renderMultipleGauge(timeSeries, theme);
      } else if (timeSeries.length > 0) {
        return this.renderSingleGauge(timeSeries, theme);
      } else {
        return null;
      }
    } else if (panelData.tableData) {
      return this.renderGaugeWithTableData(panelData, theme);
    } else {
      return <div className="singlestat-panel">No time series data available</div>;
    }
  }

  render() {
    return <ThemeProvider>{theme => this.renderPanel(theme)}</ThemeProvider>;
  }
}
