import { ReactNode, useEffect, useRef, useState } from 'react';

import { TableCellDisplayMode } from '@grafana/schema';

import AutoCell from './AutoCell';
import { BarGaugeCell } from './BarGaugeCell';
import { SparklineCell } from './SparklineCell';

// interface TableCellNGProps {
//     fieldConfig: FieldConfig;
//     fieldDisplay: any?
// }

export function TableCellNG(props: any) {
  const { field, value, theme, timeRange, height, rowIdx, justifyContent, shouldTextOverflow } = props;
  const { config: fieldConfig } = field;
  const { type: cellType } = fieldConfig.custom.cellOptions;

  const divRef = useRef<HTMLDivElement>(null);
  const [divWidth, seDivWidth] = useState(0);

  useEffect(() => {
    if (divRef.current) {
      seDivWidth(divRef.current.clientWidth);
    }
  }, []);

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
          width={divWidth}
          rowIdx={rowIdx}
          justifyContent={justifyContent}
        />
      );
      break;
    case TableCellDisplayMode.Gauge:
    case TableCellDisplayMode.BasicGauge:
    case TableCellDisplayMode.GradientGauge:
    case TableCellDisplayMode.LcdGauge:
      cell = (
        <BarGaugeCell
          value={value}
          field={field}
          theme={theme}
          timeRange={timeRange}
          height={height}
          width={divWidth}
        />
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

  return <div ref={divRef}>{cell}</div>;
}
