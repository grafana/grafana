// Libraries
import React, { PureComponent } from 'react';

// Services & Utils
import { processTimeSeries } from '@grafana/ui';
import { config } from 'app/core/config';

// Components
import { Gauge } from '@grafana/ui';

// Types
import { GaugeOptions } from './types';
import { PanelProps, NullValueMode } from '@grafana/ui/src/types';

interface Props extends PanelProps<GaugeOptions> {}

export class GaugePanel extends PureComponent<Props> {
  renderMultipleGauge(timeSeries) {
    const { options, height, width } = this.props;

    return timeSeries.map((series, index) => {
      const singleStatWidth = 1 / timeSeries.length * 100;
      const singleStatHeight = 1 / timeSeries.length * 100;
      const repeatingGaugeWidth = Math.floor(width / timeSeries.length) - 10; // make Gauge slightly smaller than panel.
      const repeatingGaugeHeight = Math.floor(height / timeSeries.length) - 10;

      const horizontalPanels = {
        display: 'inline-block',
        height: height,
        width: `${singleStatWidth}%`,
      };

      const verticalPanels = {
        display: 'block',
        width: width,
        height: `${singleStatHeight}%`,
      };

      let style = {};
      let gaugeWidth = width;
      let gaugeHeight = height;

      if (width > height) {
        style = horizontalPanels;
        gaugeWidth = repeatingGaugeWidth;
      } else if (height > width) {
        style = verticalPanels;
        gaugeHeight = repeatingGaugeHeight;
      }

      return (
        <div className="singlestat-panel" key={`${timeSeries.label}-${index}`} style={style}>
          {this.renderGauge(series.stats[options.stat], gaugeWidth, gaugeHeight)}
          <div style={{ textAlign: 'center' }}>{series.label}</div>
        </div>
      );
    });
  }

  renderGauge(value, width, height) {
    const { onInterpolate, options } = this.props;
    const prefix = onInterpolate(options.prefix);
    const suffix = onInterpolate(options.suffix);

    return (
      <Gauge
        value={value}
        {...options}
        prefix={prefix}
        suffix={suffix}
        theme={config.theme}
        width={width}
        height={height}
      />
    );
  }

  renderSingleGauge(timeSeries) {
    const { options, width, height } = this.props;

    return (
      <div className="singlestat-panel">
        {this.renderGauge(timeSeries[0].stats[options.stat], width, height)}
      </div>
    );
  }

  renderGaugeWithTableData(panelData) {
    const { width, height } = this.props;
    const firstTableDataValue = panelData.tableData.rows[0].find(prop => prop > 0);

    return <div className="singlestat-panel">{this.renderGauge(firstTableDataValue, width, height)}</div>;
  }

  render() {
    const { panelData } = this.props;

    if (panelData.timeSeries) {
      const timeSeries = processTimeSeries({
        timeSeries: panelData.timeSeries,
        nullValueMode: NullValueMode.Null,
      });

      if (timeSeries.length > 1) {
        return this.renderMultipleGauge(timeSeries);
      } else if (timeSeries.length > 0) {
        return this.renderSingleGauge(timeSeries);
      } else {
        return null;
      }
    } else if (panelData.tableData) {
      return this.renderGaugeWithTableData(panelData);
    } else {
      return <div className="singlestat-panel">No time series data available</div>;
    }
  }
}
