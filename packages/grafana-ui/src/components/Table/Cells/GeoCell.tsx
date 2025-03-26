import WKT from 'ol/format/WKT';
import { Geometry } from 'ol/geom';

import { TableCellProps } from '../types';

export function GeoCell(props: TableCellProps): JSX.Element {
  const { cell, tableStyles, cellProps } = props;

  let disp = '';

  if (cell.value instanceof Geometry) {
    disp = new WKT().writeGeometry(cell.value, {
      featureProjection: 'EPSG:3857',
      dataProjection: 'EPSG:4326',
    });
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
