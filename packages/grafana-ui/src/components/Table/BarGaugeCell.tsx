import React, { FC } from 'react';
import { ReactTableCellProps, TableCellDisplayMode } from './types';
import { BarGauge, BarGaugeDisplayMode } from '../BarGauge/BarGauge';
import { ThresholdsConfig, ThresholdsMode, VizOrientation } from '@grafana/data';

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

export const BarGaugeCell: FC<ReactTableCellProps> = props => {
  const { column, tableStyles, cell } = props;
  const { field } = column;

  if (!field.display) {
    return null;
  }

  let { config } = field;
  if (!config.thresholds) {
    config = {
      ...config,
      thresholds: defaultScale,
    };
  }

  const displayValue = field.display(cell.value);
  let barGaugeMode = BarGaugeDisplayMode.Gradient;

  if (field.config.custom && field.config.custom.displayMode === TableCellDisplayMode.LcdGauge) {
    barGaugeMode = BarGaugeDisplayMode.Lcd;
  }

  return (
    <div className={tableStyles.tableCell}>
      <BarGauge
        width={column.width - tableStyles.cellPadding * 2}
        height={tableStyles.cellHeightInner}
        field={config}
        value={displayValue}
        orientation={VizOrientation.Horizontal}
        theme={tableStyles.theme}
        itemSpacing={1}
        lcdCellWidth={8}
        displayMode={barGaugeMode}
      />
    </div>
  );
};
