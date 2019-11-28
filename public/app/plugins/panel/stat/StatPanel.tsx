// Libraries
import React, { PureComponent } from 'react';

// Utils & Services
import { config } from 'app/core/config';

// Types
import { StatPanelOptions } from './types';
import { VizRepeater, BigValue, DataLinksContextMenu, BigValueSparkline, BigValueGraphMode } from '@grafana/ui';

import {
  PanelProps,
  getFieldDisplayValues,
  FieldDisplay,
  getDisplayValueAlignmentFactors,
  DisplayValueAlignmentFactors,
} from '@grafana/data';
import { getFieldLinksSupplier } from 'app/features/panel/panellinks/linkSuppliers';

export class StatPanel extends PureComponent<PanelProps<StatPanelOptions>> {
  renderValue = (
    value: FieldDisplay,
    width: number,
    height: number,
    alignmentFactors: DisplayValueAlignmentFactors
  ): JSX.Element => {
    const { timeRange, options } = this.props;
    let sparkline: BigValueSparkline | undefined;

    if (value.sparkline) {
      sparkline = {
        data: value.sparkline,
        minX: timeRange.from.valueOf(),
        maxX: timeRange.to.valueOf(),
      };
    }

    return (
      <DataLinksContextMenu links={getFieldLinksSupplier(value)}>
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
    const { data, options, replaceVariables } = this.props;

    return getFieldDisplayValues({
      ...options,
      replaceVariables,
      theme: config.theme,
      data: data.series,
      sparkline: options.graphMode !== BigValueGraphMode.None,
    });
  };

  render() {
    const { height, width, options, data, renderCounter } = this.props;
    return (
      <VizRepeater
        getValues={this.getValues}
        getAlignmentFactors={getDisplayValueAlignmentFactors}
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
