import { ReactNode } from 'react';

import { TableCellDisplayMode } from '@grafana/schema';

import AutoCell from './AutoCell';
import { BarGaugeCell } from './BarGaugeCell';
import { SparklineCell } from './SparklineCell';

// interface TableCellNGProps {
//     fieldConfig: FieldConfig;
//     fieldDisplay: any?
// }

export function TableCellNG(props: any) {
  const { defaultPadding, field, value, theme, timeRange, height, rowIdx, justifyContent, shouldTextOverflow } = props;
  const { config: fieldConfig } = field;
  const { type: cellType } = fieldConfig.custom.cellOptions;

  // Get the correct cell type
  let cell: ReactNode = null;
  switch (cellType) {
    // case TableCellDisplayMode.
    case TableCellDisplayMode.Sparkline:
      cell = (
        <SparklineCell
          value={value}
          field={field}
          theme={theme}
          timeRange={timeRange}
          height={height}
          rowIdx={rowIdx}
          justifyContent={justifyContent}
        />
      );
      break;
    case TableCellDisplayMode.Gauge:
    case TableCellDisplayMode.BasicGauge:
    case TableCellDisplayMode.GradientGauge:
    case TableCellDisplayMode.LcdGauge:
      // The gauge cell is just inheriting the 36px height of the cell, so when padding is applied
      // the cell doesn't adhere to the padding.
      const paddingOffsetHeight = height - defaultPadding;
      cell = (
        <BarGaugeCell value={value} field={field} theme={theme} timeRange={timeRange} height={paddingOffsetHeight} />
      );
      break;
    case TableCellDisplayMode.Auto:
    default:
      cell = (
        <AutoCell
          value={value}
          field={field}
          theme={theme}
          justifyContent={justifyContent}
          shouldTextOverflow={shouldTextOverflow}
        />
      );
  }

  return cell;
}
