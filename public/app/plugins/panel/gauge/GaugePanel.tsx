// Libraries
import React, { PureComponent } from 'react';

// Services & Utils
import { processSingleStatPanelData } from '@grafana/ui';
import { config } from 'app/core/config';

// Components
import { Gauge, VizRepeater } from '@grafana/ui';

// Types
import { GaugeOptions } from './types';
import { PanelProps, VizOrientation } from '@grafana/ui/src/types';

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

  render() {
    const { panelData, options, height, width } = this.props;

    const values = processSingleStatPanelData({
      panelData: panelData,
      stat: options.valueOptions.stat,
    });

    return (
      <VizRepeater height={height} width={width} values={values} orientation={VizOrientation.Auto}>
        {({ vizHeight, vizWidth, valueInfo }) => this.renderGauge(valueInfo.value, vizWidth, vizHeight)}
      </VizRepeater>
    );
  }
}
