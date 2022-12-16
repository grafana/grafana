import { isFunction } from 'lodash';
import React, { FC } from 'react';

import { ThresholdsConfig, ThresholdsMode, VizOrientation, getFieldConfigWithMinMax } from '@grafana/data';
import { BarGaugeDisplayMode } from '@grafana/schema';

import { BarGauge } from '../BarGauge/BarGauge';
import { DataLinksContextMenu, DataLinksContextMenuApi } from '../DataLinks/DataLinksContextMenu';

import { TableCellProps, TableCellDisplayMode } from './types';

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

export const BarGaugeCell: FC<TableCellProps> = (props) => {
  const { field, innerWidth, tableStyles, cell, cellProps, row } = props;

  let config = getFieldConfigWithMinMax(field, false);
  if (!config.thresholds) {
    config = {
      ...config,
      thresholds: defaultScale,
    };
  }

  const displayValue = field.display!(cell.value);

  // Set default display mode
  let barGaugeMode = BarGaugeDisplayMode.Gradient;

  // Support deprecated settings
  const usingDeprecatedSettings = field.config.custom.cellOptions.subOptions.gauge === undefined;

  // If we're using the old settings format we read the displayMode directly from
  // the cell options
  if (usingDeprecatedSettings) {
    if (
      (field.config.custom && field.config.custom.cellOptions.displayMode === TableCellDisplayMode.Gauge) ||
      (field.config.custom && field.config.custom.cellOptions.displayMode === BarGaugeDisplayMode.Lcd)
    ) {
      barGaugeMode = BarGaugeDisplayMode.Lcd;
    } else if (
      (field.config.custom && field.config.custom.cellOptions.displayMode === TableCellDisplayMode.Gauge) ||
      (field.config.custom && field.config.custom.cellOptions.displayMode === BarGaugeDisplayMode.Basic)
    ) {
      barGaugeMode = BarGaugeDisplayMode.Basic;
    }
  }
  // Otherwise in the case of sub-options we read specifically from the sub-options
  // object in order to get the display mode
  else {
    const gaugeOptions = field.config.custom.cellOptions.subOptions.gauge;
    barGaugeMode = gaugeOptions.displayMode;
  }

  const getLinks = () => {
    if (!isFunction(field.getLinks)) {
      return [];
    }

    return field.getLinks({ valueRowIndex: row.index });
  };

  const hasLinks = Boolean(getLinks().length);

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
        onClick={openMenu}
        className={targetClassName}
        itemSpacing={1}
        lcdCellWidth={8}
        displayMode={barGaugeMode}
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
      {!hasLinks && (
        <BarGauge
          width={innerWidth}
          height={tableStyles.cellHeightInner}
          field={config}
          display={field.display}
          text={{ valueSize: 14 }}
          value={displayValue}
          orientation={VizOrientation.Horizontal}
          theme={tableStyles.theme}
          itemSpacing={1}
          lcdCellWidth={8}
          displayMode={barGaugeMode}
        />
      )}
    </div>
  );
};
