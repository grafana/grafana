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
  ReducerID,
  getDisplayValueAlignmentFactors,
  DisplayValueAlignmentFactors,
  VizOrientation,
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
        xMin: timeRange.from.valueOf(),
        xMax: timeRange.to.valueOf(),
        yMin: value.field.min,
        yMax: value.field.max,
      };

      const calc = options.fieldOptions.calcs[0];
      if (calc === ReducerID.last) {
        sparkline.highlightIndex = sparkline.data.length - 1;
      }
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
      autoMinMax: true,
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
        renderCounter={renderCounter}
        orientation={getOrientation(width, height, options.orientation)}
      />
    );
  }
}

/**
 * Stat panel custom auto orientation
 */
function getOrientation(width: number, height: number, orientation: VizOrientation): VizOrientation {
  if (orientation !== VizOrientation.Auto) {
    return orientation;
  }

  if (width / height > 2) {
    return VizOrientation.Vertical;
  } else {
    return VizOrientation.Horizontal;
  }
}
