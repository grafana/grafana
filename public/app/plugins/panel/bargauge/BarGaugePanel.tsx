// Libraries
import React, { PureComponent } from 'react';

// Services & Utils
import { config } from 'app/core/config';

// Components
import { BarGauge, VizRepeater, getFieldDisplayValues, FieldDisplay } from '@grafana/ui';

// Types
import { BarGaugeOptions } from './types';
import { PanelProps } from '@grafana/ui/src/types';

export class BarGaugePanel extends PureComponent<PanelProps<BarGaugeOptions>> {
  renderValue = (value: FieldDisplay, width: number, height: number): JSX.Element => {
    const { options } = this.props;
    const { fieldOptions } = options;
    const { field, display } = value;

    return (
      <BarGauge
        value={display}
        width={width}
        height={height}
        orientation={options.orientation}
        thresholds={fieldOptions.thresholds}
        theme={config.theme}
        itemSpacing={this.getItemSpacing()}
        displayMode={options.displayMode}
        minValue={field.min}
        maxValue={field.max}
      />
    );
  };

  getValues = (): FieldDisplay[] => {
    const { data, options, replaceVariables } = this.props;
    return getFieldDisplayValues({
      ...options,
      replaceVariables,
      theme: config.theme,
      data: data.series,
    });
  };

  getItemSpacing(): number {
    if (this.props.options.displayMode === 'lcd') {
      return 2;
    }

    return 10;
  }

  render() {
    const { height, width, options, data, renderCounter } = this.props;

    return (
      <VizRepeater
        source={data}
        getValues={this.getValues}
        renderValue={this.renderValue}
        renderCounter={renderCounter}
        width={width}
        height={height}
        itemSpacing={this.getItemSpacing()}
        orientation={options.orientation}
      />
    );
  }
}
