// Libraries
import React, { PureComponent } from 'react';

// Services & Utils
import { processTimeSeries } from '@grafana/ui';
import { config } from 'app/core/config';

// Components
import { Gauge, VizRepeater } from '@grafana/ui';

// Types
import { GaugeOptions } from './types';
import { PanelProps, NullValueMode } from '@grafana/ui/src/types';

interface Props extends PanelProps<GaugeOptions> {}

export class GaugePanel extends PureComponent<Props> {
  renderGauge(value, width, height) {
    const { onInterpolate, options } = this.props;
    const { valueOptions } = options;
    const prefix = onInterpolate(valueOptions.prefix);
    const suffix = onInterpolate(valueOptions.suffix);

    return (
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
        theme={config.theme}
      />
    );
  }

  renderSingleGauge(timeSeries) {
    const { options, width, height } = this.props;
    const value = timeSeries[0].stats[options.valueOptions.stat];

    return <div className="singlestat-panel">{this.renderGauge(value, width, height)}</div>;
  }

  renderGaugeWithTableData(panelData) {
    const { width, height } = this.props;
    const firstTableDataValue = panelData.tableData.rows[0].find(prop => prop > 0);

    return <div className="singlestat-panel">{this.renderGauge(firstTableDataValue, width, height)}</div>;
  }

  render() {
    const { panelData, options, height, width } = this.props;
    const { stat } = options.valueOptions;

    if (panelData.timeSeries) {
      const timeSeries = processTimeSeries({
        timeSeries: panelData.timeSeries,
        nullValueMode: NullValueMode.Null,
      });

      if (timeSeries.length > 1) {
        return (
          <VizRepeater timeSeries={timeSeries} width={width} height={height}>
            {({ vizHeight, vizWidth, vizContainerStyle }) => {
              return timeSeries.map((series, index) => {
                const value = stat !== 'name' ? series.stats[stat] : series.label;

                return (
                  <div className="singlestat-panel" key={`${series.label}-${index}`} style={vizContainerStyle}>
                    {this.renderGauge(value, vizWidth, vizHeight)}
                  </div>
                );
              });
            }}
          </VizRepeater>
        );
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
