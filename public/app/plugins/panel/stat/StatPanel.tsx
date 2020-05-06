import React, { PureComponent } from 'react';
import {
  BigValue,
  BigValueGraphMode,
  BigValueSparkline,
  DataLinksContextMenu,
  VizRepeater,
  VizRepeaterRenderValueProps,
} from '@grafana/ui';
import {
  DisplayValueAlignmentFactors,
  FieldDisplay,
  getDisplayValueAlignmentFactors,
  getFieldDisplayValues,
  PanelProps,
  ReducerID,
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
    const { value, alignmentFactors, width, height } = valueProps;
    const { openMenu, targetClassName } = menuProps;
    let sparkline: BigValueSparkline | undefined;

    if (value.sparkline) {
      sparkline = {
        data: value.sparkline,
        xMin: timeRange.from.valueOf(),
        xMax: timeRange.to.valueOf(),
        yMin: value.field.min,
        yMax: value.field.max,
      };

      const calc = options.reduceOptions.calcs[0];
      if (calc === ReducerID.last) {
        sparkline.highlightIndex = sparkline.data.length - 1;
      }
    }

    return (
      <BigValue
        value={value.display}
        sparkline={sparkline}
        colorMode={options.colorMode}
        graphMode={options.graphMode}
        justifyMode={options.justifyMode}
        alignmentFactors={alignmentFactors}
        width={width}
        height={height}
        theme={config.theme}
        onClick={openMenu}
        className={targetClassName}
      />
    );
  };
  renderValue = (valueProps: VizRepeaterRenderValueProps<FieldDisplay, DisplayValueAlignmentFactors>): JSX.Element => {
    const { value } = valueProps;
    const { getLinks, hasLinks } = value;

    if (!hasLinks) {
      return this.renderComponent(valueProps, {});
    }

    return (
      <DataLinksContextMenu links={getLinks}>
        {api => {
          return this.renderComponent(valueProps, api);
        }}
      </DataLinksContextMenu>
    );
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
      autoMinMax: true,
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
