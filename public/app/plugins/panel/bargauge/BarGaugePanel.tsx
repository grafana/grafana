// Libraries
import React, { PureComponent } from 'react';

// Services & Utils
import { config } from 'app/core/config';

import { BarGauge, BarGaugeAlignmentFactors, VizRepeater, DataLinksContextMenu } from '@grafana/ui';
import { BarGaugeOptions } from './types';
import { getFieldDisplayValues, FieldDisplay, PanelProps } from '@grafana/data';
import { getFieldLinksSupplier } from 'app/features/panel/panellinks/linkSuppliers';

export class BarGaugePanel extends PureComponent<PanelProps<BarGaugeOptions>> {
  findMaximumInput = (values: FieldDisplay[], width: number, height: number): BarGaugeAlignmentFactors => {
    const info: BarGaugeAlignmentFactors = {
      title: '',
      text: '',
    };

    for (let i = 0; i < values.length; i++) {
      const v = values[i].display;
      if (v.text && v.text.length > info.text.length) {
        info.text = v.text;
      }

      if (v.title && v.title.length > info.title.length) {
        info.title = v.title;
      }
    }
    return info;
  };

  renderValue = (
    value: FieldDisplay,
    width: number,
    height: number,
    alignmentFactors: BarGaugeAlignmentFactors
  ): JSX.Element => {
    const { options } = this.props;
    const { field, display } = value;

    return (
      <DataLinksContextMenu links={getFieldLinksSupplier(value)}>
        {({ openMenu, targetClassName }) => {
          return (
            <BarGauge
              value={display}
              width={width}
              height={height}
              orientation={options.orientation}
              thresholds={field.thresholds}
              theme={config.theme}
              itemSpacing={this.getItemSpacing()}
              displayMode={options.displayMode}
              minValue={field.min}
              maxValue={field.max}
              onClick={openMenu}
              className={targetClassName}
              alignmentFactors={alignmentFactors}
            />
          );
        }}
      </DataLinksContextMenu>
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
        getAlignmentFactors={this.findMaximumInput}
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
