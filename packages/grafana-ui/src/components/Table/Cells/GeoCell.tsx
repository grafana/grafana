import type { JSX } from 'react';

import { useOpenLayersContext } from '../OpenLayersContext';
import { type TableCellProps } from '../types';

export function GeoCell(props: TableCellProps): JSX.Element {
  const { cell, tableStyles, cellProps } = props;
  const { formatGeometry } = useOpenLayersContext();

  let disp = '';

  if (
    formatGeometry &&
    // alternative to instanceof Geometry without importing the whole class from ol
    typeof cell.value === 'object' &&
    cell.value != null &&
    'intersectsCoordinate' in cell.value
  ) {
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
