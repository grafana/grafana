// Libraries
import React, { PureComponent } from 'react';

// Services & Utils
import { config } from 'app/core/config';

// Components
import { Gauge, FieldDisplay, getFieldDisplayValues, getScaledFieldHelper } from '@grafana/ui';

// Types
import { GaugeOptions } from './types';
import { PanelProps, VizRepeater } from '@grafana/ui';

export class GaugePanel extends PureComponent<PanelProps<GaugeOptions>> {
  renderValue = (value: FieldDisplay, width: number, height: number): JSX.Element => {
    const { options } = this.props;
    const { field, display } = value;
    const scale = getScaledFieldHelper(field, config.theme.type);

    return (
      <Gauge
        value={display}
        width={width}
        height={height}
        scale={scale}
        showThresholdLabels={options.showThresholdLabels}
        showThresholdMarkers={options.showThresholdMarkers}
        theme={config.theme}
      />
    );
  };

  getValues = (): FieldDisplay[] => {
    const { data, options, replaceVariables } = this.props;
    return getFieldDisplayValues({
      fieldOptions: options.fieldOptions,
      replaceVariables,
      theme: config.theme,
      data: data.series,
    });
  };

  render() {
    const { height, width, options, data, renderCounter } = this.props;
    return (
      <VizRepeater
        getValues={this.getValues}
        renderValue={this.renderValue}
        width={width}
        height={height}
        source={data}
        renderCounter={renderCounter}
        orientation={options.orientation}
      />
    );
  }
}
