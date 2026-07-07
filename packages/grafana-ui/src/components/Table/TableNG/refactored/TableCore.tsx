import { type TableNGProps } from '../types';

import { Safari26Wrapper } from './Safari26Wrapper';
import { TableFlat } from './TableFlat';
import { TableSizeContainer } from './TableSizeContainer';
import { getLeanCellRenderer } from './leanCellRenderer';

/**
 * Lean, general-purpose table. Renders a DataFrame as a flat grid (sort, filter, resize,
 * virtualization, footers, the custom-cell seam) without the panel-oriented cell-type abstraction:
 * fields render as plain text unless a consumer supplies a custom cell. This is the entry point for
 * callers that just want a data grid; use `TableNG` when the rich field-config-driven cell types
 * (gauge, sparkline, markdown, pill, image, data links, actions) are required.
 *
 * Nested frames are intentionally not supported here — that path lives in the batteries-included
 * `TableNG`.
 */
export function TableCore(props: TableNGProps) {
  return (
    <TableSizeContainer width={props.width} height={props.height}>
      <Safari26Wrapper>
        <TableFlat {...props} getCellRenderer={getLeanCellRenderer} />
      </Safari26Wrapper>
    </TableSizeContainer>
  );
}
