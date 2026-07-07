import { memo } from 'react';

import { TableCellDisplayMode, type TableCustomCellOptions } from '../../types';
import { AutoCell } from '../Cells/AutoCell';
import { type CellRendererResolver, type TableCellRenderer, type TableCellRendererProps } from '../types';

const LeanAutoCellRenderer = memo((props: TableCellRendererProps) => (
  <AutoCell value={props.value} field={props.field} rowIdx={props.rowIdx} />
));
LeanAutoCellRenderer.displayName = 'LeanAutoCellRenderer';

const LeanCustomCellRenderer = memo((props: TableCellRendererProps) => {
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  const cellOptions = props.cellOptions as TableCustomCellOptions;
  if (cellOptions.type !== TableCellDisplayMode.Custom || !cellOptions.cellComponent) {
    return null;
  }
  const CustomCellComponent = cellOptions.cellComponent;
  return <CustomCellComponent field={props.field} rowIndex={props.rowIdx} frame={props.frame} value={props.value} />;
});
LeanCustomCellRenderer.displayName = 'LeanCustomCellRenderer';

/**
 * Minimal cell-renderer resolver for the lean table. Every field renders as plain text (Auto),
 * except the explicit custom-cell seam. It deliberately does NOT reach into the rich cell-type
 * registry (gauge, sparkline, markdown, pill, geo, image, data links, actions), so consumers that
 * just want a data grid don't inherit the panel-oriented cell-type abstraction.
 */
export const getLeanCellRenderer: CellRendererResolver = (_field, cellOptions): TableCellRenderer =>
  cellOptions?.type === TableCellDisplayMode.Custom ? LeanCustomCellRenderer : LeanAutoCellRenderer;
