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

export class StatPanel extends PureComponent<PanelProps<StatPanelOptions>> {
  renderValue = (valueProps: VizRepeaterRenderValueProps<FieldDisplay, DisplayValueAlignmentFactors>): JSX.Element => {
    const { timeRange, options } = this.props;
    const { value, alignmentFactors, width, height } = valueProps;
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
      <DataLinksContextMenu links={value.getLinks} hasLinks={value.hasLinks}>
        {({ openMenu, targetClassName }) => {
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
