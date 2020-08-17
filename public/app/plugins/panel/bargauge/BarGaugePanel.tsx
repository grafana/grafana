import React, { PureComponent } from 'react';
import {
  DisplayValueAlignmentFactors,
  FieldDisplay,
  getDisplayValueAlignmentFactors,
  getFieldDisplayValues,
  PanelProps,
  FieldConfig,
  DisplayProcessor,
  DisplayValue,
} from '@grafana/data';
import { BarGauge, DataLinksContextMenu, VizRepeater, VizRepeaterRenderValueProps } from '@grafana/ui';

import { config } from 'app/core/config';
import { BarGaugeOptions } from './types';
import { DataLinksContextMenuApi } from '@grafana/ui/src/components/DataLinks/DataLinksContextMenu';
import { isNumber } from 'lodash';

export class BarGaugePanel extends PureComponent<PanelProps<BarGaugeOptions>> {
  renderComponent = (
    valueProps: VizRepeaterRenderValueProps<FieldDisplay, DisplayValueAlignmentFactors>,
    menuProps: DataLinksContextMenuApi
  ): JSX.Element => {
    const { options, fieldConfig } = this.props;
    const { value, alignmentFactors, orientation, width, height, count } = valueProps;
    const { field, display, view, colIndex } = value;
    const { openMenu, targetClassName } = menuProps;

    let processor: DisplayProcessor | undefined = undefined;
    if (view && isNumber(colIndex)) {
      processor = view!.getFieldDisplayProcessor(colIndex as number);
    }

    return (
      <BarGauge
        value={clearNameForSingleSeries(count, fieldConfig.defaults, display)}
        width={width}
        height={height}
        orientation={orientation}
        field={field}
        display={processor}
        theme={config.theme}
        itemSpacing={this.getItemSpacing()}
        displayMode={options.displayMode}
        onClick={openMenu}
        className={targetClassName}
        alignmentFactors={count > 1 ? alignmentFactors : undefined}
        showUnfilled={options.showUnfilled}
      />
    );
  };

  renderValue = (valueProps: VizRepeaterRenderValueProps<FieldDisplay, DisplayValueAlignmentFactors>): JSX.Element => {
    const { value } = valueProps;
    const { hasLinks, getLinks } = value;

    if (hasLinks && getLinks) {
      return (
        <DataLinksContextMenu links={getLinks}>
          {api => {
            return this.renderComponent(valueProps, api);
          }}
        </DataLinksContextMenu>
      );
    }

    return this.renderComponent(valueProps, {});
  };

  getValues = (): FieldDisplay[] => {
    const { data, options, replaceVariables, fieldConfig, timeZone } = this.props;
    return getFieldDisplayValues({
      fieldConfig,
      reduceOptions: options.reduceOptions,
      replaceVariables,
      theme: config.theme,
      data: data.series,
      autoMinMax: true,
      timeZone,
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
        getAlignmentFactors={getDisplayValueAlignmentFactors}
        getValues={this.getValues}
        renderValue={this.renderValue}
        renderCounter={renderCounter}
        width={width}
        height={height}
        minVizHeight={10}
        itemSpacing={this.getItemSpacing()}
        orientation={options.orientation}
      />
    );
  }
}

export function clearNameForSingleSeries(count: number, field: FieldConfig<any>, display: DisplayValue): DisplayValue {
  if (count === 1 && !field.displayName) {
    return {
      ...display,
      title: undefined,
    };
  }

  return display;
}
