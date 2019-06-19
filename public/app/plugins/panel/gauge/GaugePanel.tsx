// Libraries
import React, { PureComponent } from 'react';

// Services & Utils
import { config } from 'app/core/config';

// Components
import { Gauge, FieldDisplay, getFieldDisplayValues, VizOrientation } from '@grafana/ui';

// Types
import { GaugeOptions } from './types';
import { PanelProps, VizRepeater } from '@grafana/ui';

export class GaugePanel extends PureComponent<PanelProps<GaugeOptions>> {
  renderValue = (value: FieldDisplay, width: number, height: number): JSX.Element => {
    const { options } = this.props;
    const { fieldOptions } = options;
    const { field, display } = value;

    return (
      <Gauge
        value={display}
        width={width}
        height={height}
        thresholds={fieldOptions.thresholds}
        showThresholdLabels={options.showThresholdLabels}
        showThresholdMarkers={options.showThresholdMarkers}
        minValue={field.min}
        maxValue={field.max}
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
    const { height, width, data, renderCounter } = this.props;
    return (
      <VizRepeater
        getValues={this.getValues}
        renderValue={this.renderValue}
        width={width}
        height={height}
        source={data}
        renderCounter={renderCounter}
        orientation={VizOrientation.Auto}
      />
    );
  }
}
