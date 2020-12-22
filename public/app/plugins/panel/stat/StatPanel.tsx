import React, { PureComponent } from 'react';
import {
  BigValue,
  BigValueGraphMode,
  DataLinksContextMenu,
  VizRepeater,
  VizRepeaterRenderValueProps,
  BigValueTextMode,
} from '@grafana/ui';
import {
  DisplayValueAlignmentFactors,
  FieldDisplay,
  getDisplayValueAlignmentFactors,
  getFieldDisplayValues,
  PanelProps,
} from '@grafana/data';

import { config } from 'app/core/config';
import { StatPanelOptions } from './types';
import { DataLinksContextMenuApi } from '@grafana/ui/src/components/DataLinks/DataLinksContextMenu';

export class StatPanel extends PureComponent<PanelProps<StatPanelOptions>> {
  renderComponent = (
    valueProps: VizRepeaterRenderValueProps<FieldDisplay, DisplayValueAlignmentFactors>,
    menuProps: DataLinksContextMenuApi
  ): JSX.Element => {
    const { timeRange, options } = this.props;
    const { value, alignmentFactors, width, height, count } = valueProps;
    const { openMenu, targetClassName } = menuProps;
    let sparkline = value.sparkline;
    if (sparkline) {
      sparkline.timeRange = timeRange;
    }

    return (
      <BigValue
        value={value.display}
        count={count}
        sparkline={sparkline}
        colorMode={options.colorMode}
        graphMode={options.graphMode}
        justifyMode={options.justifyMode}
        textMode={this.getTextMode()}
        alignmentFactors={alignmentFactors}
        text={options.text}
        width={width}
        height={height}
        theme={config.theme}
        onClick={openMenu}
        className={targetClassName}
      />
    );
  };

  getTextMode() {
    const { options, fieldConfig, title } = this.props;

    // If we have manually set displayName or panel title switch text mode to value and name
    if (options.textMode === BigValueTextMode.Auto && (fieldConfig.defaults.displayName || !title)) {
      return BigValueTextMode.ValueAndName;
    }

    return options.textMode;
  }

  renderValue = (valueProps: VizRepeaterRenderValueProps<FieldDisplay, DisplayValueAlignmentFactors>): JSX.Element => {
    const { value } = valueProps;
    const { getLinks, hasLinks } = value;

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
      sparkline: options.graphMode !== BigValueGraphMode.None,
      timeZone,
    });
  };

  render() {
    const { height, options, width, data, renderCounter } = this.props;

    return (
      <VizRepeater
        getValues={this.getValues}
        getAlignmentFactors={getDisplayValueAlignmentFactors}
        renderValue={this.renderValue}
        width={width}
        height={height}
        source={data}
        itemSpacing={3}
        renderCounter={renderCounter}
        autoGrid={true}
        orientation={options.orientation}
      />
    );
  }
}
