import { isFunction } from 'lodash';
import React from 'react';

import {
  ThresholdsConfig,
  ThresholdsMode,
  VizOrientation,
  getFieldConfigWithMinMax,
  DisplayValueAlignmentFactors,
  Field,
  DisplayValue,
} from '@grafana/data';
import { BarGaugeDisplayMode, BarGaugeValueMode } from '@grafana/schema';

import { BarGauge } from '../BarGauge/BarGauge';
import { DataLinksContextMenu, DataLinksContextMenuApi } from '../DataLinks/DataLinksContextMenu';

import { TableCellProps, TableCellDisplayMode } from './types';
import { getCellOptions } from './utils';

const defaultScale: ThresholdsConfig = {
  mode: ThresholdsMode.Absolute,
  steps: [
    {
      color: 'blue',
      value: -Infinity,
    },
    {
      color: 'green',
      value: 20,
    },
  ],
};

export const BarGaugeCell = (props: TableCellProps) => {
  const { field, innerWidth, tableStyles, cell, cellProps, row } = props;
  const displayValue = field.display!(cell.value);
  const cellOptions = getCellOptions(field);

  let config = getFieldConfigWithMinMax(field, false);
  if (!config.thresholds) {
    config = {
      ...config,
      thresholds: defaultScale,
    };
  }

  // Set default display mode and update if defined
  // and update the valueMode if defined
  let barGaugeMode: BarGaugeDisplayMode = BarGaugeDisplayMode.Gradient;
  let valueDisplayMode: BarGaugeValueMode | undefined = undefined;

  if (cellOptions.type === TableCellDisplayMode.Gauge) {
    barGaugeMode = cellOptions.mode ?? BarGaugeDisplayMode.Gradient;
    valueDisplayMode =
      cellOptions.valueDisplayMode !== undefined ? cellOptions.valueDisplayMode : BarGaugeValueMode.Text;
  }

  const getLinks = () => {
    if (!isFunction(field.getLinks)) {
      return [];
    }

    return field.getLinks({ valueRowIndex: row.index });
  };

  const hasLinks = Boolean(getLinks().length);
  const alignmentFactors = getAlignmentFactor(field, displayValue, cell.row.index);

  const renderComponent = (menuProps: DataLinksContextMenuApi) => {
    const { openMenu, targetClassName } = menuProps;

    return (
      <BarGauge
        width={innerWidth}
        height={tableStyles.cellHeightInner}
        field={config}
        display={field.display}
        text={{ valueSize: 14 }}
        value={displayValue}
        orientation={VizOrientation.Horizontal}
        theme={tableStyles.theme}
        alignmentFactors={alignmentFactors}
        onClick={openMenu}
        className={targetClassName}
        itemSpacing={1}
        lcdCellWidth={8}
        displayMode={barGaugeMode}
        valueDisplayMode={valueDisplayMode}
      />
    );
  };

  return (
    <div {...cellProps} className={tableStyles.cellContainer}>
      {hasLinks && (
        <DataLinksContextMenu links={getLinks} style={{ display: 'flex', width: '100%' }}>
          {(api) => renderComponent(api)}
        </DataLinksContextMenu>
      )}
      {!hasLinks && renderComponent({})}
    </div>
  );
};

/**
 * Getting gauge values to align is very tricky without looking at all values and passing them trough display processor. For very large tables that
 * could pretty expensive. So this is kind of a compromise. We look at the first 1000 rows and cache the longest value.
 * If we have a cached value we just check if the current value is longer and update the alignmentFactor. This can obviously still lead to
 * unaligned gauges but it should a lot less common.
 **/
function getAlignmentFactor(field: Field, displayValue: DisplayValue, rowIndex: number): DisplayValueAlignmentFactors {
  let alignmentFactor = field.state?.alignmentFactors;

  if (alignmentFactor) {
    // check if current alignmentFactor is still the longest
    if (alignmentFactor.text.length < displayValue.text.length) {
      alignmentFactor.text = displayValue.text;
    }
    return alignmentFactor;
  } else {
    // look at the next 100 rows
    alignmentFactor = { ...displayValue };
    const maxIndex = Math.min(field.values.length, rowIndex + 1000);

    for (let i = rowIndex + 1; i < maxIndex; i++) {
      const nextDisplayValue = field.display!(field.values.get(i));
      if (nextDisplayValue.text.length > alignmentFactor.text.length) {
        alignmentFactor.text = displayValue.text;
      }
    }

    if (field.state) {
      field.state.alignmentFactors = alignmentFactor;
    } else {
      field.state = { alignmentFactors: alignmentFactor };
    }

    return alignmentFactor;
  }
}
