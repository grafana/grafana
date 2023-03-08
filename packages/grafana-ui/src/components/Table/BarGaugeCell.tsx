import { isFunction } from 'lodash';
import React, { FC } from 'react';

import { ThresholdsConfig, ThresholdsMode, VizOrientation, getFieldConfigWithMinMax } from '@grafana/data';
import { BarGaugeDisplayMode } from '@grafana/schema';

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
  let barGaugeMode: BarGaugeDisplayMode = BarGaugeDisplayMode.Gradient;

  const cellOptions = getCellOptions(field);
  if (cellOptions.type === TableCellDisplayMode.Gauge) {
    barGaugeMode = cellOptions.mode ?? BarGaugeDisplayMode.Gradient;
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
