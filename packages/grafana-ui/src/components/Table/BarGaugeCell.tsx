import React, { FC } from 'react';
import { ReactTableCellProps } from './types';
import { BarGauge } from '../BarGauge/BarGauge';
import { VizOrientation } from '@grafana/data';

const defaultThresholds = [
  {
    color: 'blue',
    value: -Infinity,
  },
  {
    color: 'green',
    value: 20,
  },
];

export const BarGaugeCell: FC<ReactTableCellProps> = props => {
  const { column, tableStyles, cell } = props;
  const { field } = column;

  if (!field.display) {
    return null;
  }

  /* height: number; */
  /* width: number; */
  /* thresholds: Threshold[]; */
  /* value: DisplayValue; */
  /* maxValue: number; */
  /* minValue: number; */
  /* orientation: VizOrientation; */
  /* itemSpacing?: number; */
  /* displayMode: 'basic' | 'lcd' | 'gradient'; */
  /* onClick?: React.MouseEventHandler<HTMLElement>; */
  /* className?: string; */
  /* showUnfilled?: boolean; */
  /* alignmentFactors?: DisplayValueAlignmentFactors; */

  console.log('BarGaugeCell', props);
  const displayValue = field.display(cell.value);

  return (
    <BarGauge
      width={column.width - tableStyles.cellPadding * 2}
      height={tableStyles.cellHeight - tableStyles.cellPadding * 2}
      thresholds={field.config.thresholds || defaultThresholds}
      value={displayValue}
      maxValue={field.config.max || 100}
      minValue={field.config.min || 0}
      orientation={VizOrientation.Horizontal}
      theme={tableStyles.theme}
      itemSpacing={1}
      cellWidth={8}
      displayMode="gradient"
    />
  );
};
