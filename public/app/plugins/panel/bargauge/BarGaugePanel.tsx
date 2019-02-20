// Libraries
import React, { PureComponent } from 'react';

// Services & Utils
import { processTimeSeries } from '@grafana/ui';
import { config } from 'app/core/config';

// Components
import { BarGauge, VizRepeater } from '@grafana/ui';

// Types
import { BarGaugeOptions } from './types';
import { PanelProps, NullValueMode } from '@grafana/ui/src/types';

interface Props extends PanelProps<BarGaugeOptions> {}

export class BarGaugePanel extends PureComponent<Props> {
  renderBarGauge(value, width, height) {
    const { onInterpolate, options } = this.props;
    const { valueOptions } = options;
    const prefix = onInterpolate(valueOptions.prefix);
    const suffix = onInterpolate(valueOptions.suffix);

    return (
      <BarGauge
        value={value}
        width={width}
        height={height}
        prefix={prefix}
        suffix={suffix}
        orientation={options.orientation}
        unit={valueOptions.unit}
        decimals={valueOptions.decimals}
        thresholds={options.thresholds}
        valueMappings={options.valueMappings}
        theme={config.theme}
      />
    );
  }

  render() {
    const { panelData, options, width, height } = this.props;
    const { stat } = options.valueOptions;

    if (panelData.timeSeries) {
      const timeSeries = processTimeSeries({
        timeSeries: panelData.timeSeries,
        nullValueMode: NullValueMode.Null,
      });

      if (timeSeries.length > 1) {
        return (
          <VizRepeater height={height} width={width} timeSeries={timeSeries} orientation={options.orientation}>
            {({ vizHeight, vizWidth, vizContainerStyle }) => {
              return timeSeries.map((series, index) => {
                const value = stat !== 'name' ? series.stats[stat] : series.label;

                return (
                  <div key={index} style={vizContainerStyle}>
                    {this.renderBarGauge(value, vizWidth, vizHeight)}
                  </div>
                );
              });
            }}
          </VizRepeater>
        );
      } else if (timeSeries.length > 0) {
        const value = timeSeries[0].stats[options.valueOptions.stat];
        return this.renderBarGauge(value, width, height);
      }
    } else if (panelData.tableData) {
      const value = panelData.tableData.rows[0].find(prop => prop > 0);

      return this.renderBarGauge(value, width, height);
    }

    return <div className="singlestat-panel">No time series data available</div>;
  }
}
