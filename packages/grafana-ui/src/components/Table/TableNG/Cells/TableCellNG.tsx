import { ReactNode, useLayoutEffect, useRef, useState } from 'react';

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

  // TODO
  // TableNG provides either an overridden cell width or 'auto' as the cell width value.
  // While the overridden value gives the exact cell width, 'auto' does not.
  // Therefore, we need to determine the actual cell width from the DOM.
  const divWidthRef = useRef<HTMLDivElement>(null);
  const [divWidth, setDivWidth] = useState(0);

  useLayoutEffect(() => {
    if (divWidthRef.current && divWidthRef.current.clientWidth !== 0) {
      setDivWidth(divWidthRef.current.clientWidth);
    }
  }, [divWidthRef.current]); // eslint-disable-line react-hooks/exhaustive-deps

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
          cellOptions={fieldConfig.custom.cellOptions}
        />
      );
  }

  return <div ref={divWidthRef}>{cell}</div>;
}
