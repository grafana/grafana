// Libraries
import React, { PureComponent } from 'react';

// Services & Utils
import { processSingleStatPanelData } from '@grafana/ui';
import { config } from 'app/core/config';

// Components
import { BarGauge, VizRepeater } from '@grafana/ui';

// Types
import { BarGaugeOptions } from './types';
import { PanelProps, SingleStatValueInfo } from '@grafana/ui/src/types';

interface Props extends PanelProps<BarGaugeOptions> {}

export class BarGaugePanel extends PureComponent<Props> {
  renderBarGauge(value: SingleStatValueInfo, width, height) {
    const { replaceVariables, options } = this.props;
    const { valueOptions } = options;

    const prefix = replaceVariables(valueOptions.prefix);
    const suffix = replaceVariables(valueOptions.suffix);

    return (
      <BarGauge
        value={value.value as number | null}
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

    const values = processSingleStatPanelData({
      panelData: panelData,
      stat: options.valueOptions.stat,
    });

    return (
      <VizRepeater height={height} width={width} values={values} orientation={options.orientation}>
        {({ vizHeight, vizWidth, value }) => this.renderBarGauge(value, vizWidth, vizHeight)}
      </VizRepeater>
    );
  }
}
