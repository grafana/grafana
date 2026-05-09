import type { JSX } from 'react';

import { isGeometry, useOpenLayersContext } from '../geo';
import { type TableCellProps } from '../types';

export function GeoCell(props: TableCellProps): JSX.Element {
  const { cell, tableStyles, cellProps } = props;
  const { formatGeometry } = useOpenLayersContext();

  let disp = '';

  if (formatGeometry && isGeometry(cell.value)) {
    disp = formatGeometry(cell.value);
  } else if (cell.value != null) {
    disp = `${cell.value}`;
  }

  return (
    <div {...cellProps} className={tableStyles.cellContainer}>
      <div className={tableStyles.cellText} style={{ fontFamily: 'monospace' }}>
        {disp}
      </div>
    </div>
  );
}
