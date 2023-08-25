import { isNumber } from 'lodash';
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
  VizOrientation,
} from '@grafana/data';
import { BarGauge, DataLinksContextMenu, VizRepeater, VizRepeaterRenderValueProps } from '@grafana/ui';
import { DataLinksContextMenuApi } from '@grafana/ui/src/components/DataLinks/DataLinksContextMenu';
import { config } from 'app/core/config';

import { Options } from './panelcfg.gen';

export class BarGaugePanel extends PureComponent<BarGaugePanelProps> {
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
      processor = view.getFieldDisplayProcessor(colIndex);
    }

    return (
      <BarGauge
        value={clearNameForSingleSeries(count, fieldConfig.defaults, display)}
        width={width}
        height={height}
        orientation={orientation}
        field={field}
        text={options.text}
        display={processor}
        theme={config.theme2}
        itemSpacing={this.getItemSpacing()}
        displayMode={options.displayMode}
        onClick={openMenu}
        className={targetClassName}
        alignmentFactors={count > 1 ? alignmentFactors : undefined}
        showUnfilled={options.showUnfilled}
        valueDisplayMode={options.valueMode}
      />
    );
  };

  renderValue = (valueProps: VizRepeaterRenderValueProps<FieldDisplay, DisplayValueAlignmentFactors>): JSX.Element => {
    const { value, orientation } = valueProps;
    const { hasLinks, getLinks } = value;

    if (hasLinks && getLinks) {
      return (
        <div style={{ width: '100%', display: orientation === VizOrientation.Vertical ? 'flex' : 'initial' }}>
          <DataLinksContextMenu style={{ height: '100%' }} links={getLinks}>
            {(api) => this.renderComponent(valueProps, api)}
          </DataLinksContextMenu>
        </div>
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
      theme: config.theme2,
      data: data.series,
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
        minVizWidth={options.minVizWidth}
        minVizHeight={options.minVizHeight}
        itemSpacing={this.getItemSpacing()}
        orientation={options.orientation}
      />
    );
  }
}
export type BarGaugePanelProps = PanelProps<Options>;

export function clearNameForSingleSeries(count: number, field: FieldConfig, display: DisplayValue): DisplayValue {
  if (count === 1 && !field.displayName) {
    return {
      ...display,
      title: undefined,
    };
  }

  return display;
}
