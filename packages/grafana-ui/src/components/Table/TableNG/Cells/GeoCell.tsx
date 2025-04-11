import { css } from '@emotion/css';
import WKT from 'ol/format/WKT';
import { Geometry } from 'ol/geom';

import { useStyles2 } from '../../../../themes';
import { GeoCellProps } from '../types';

export function GeoCell({ value, justifyContent, height }: GeoCellProps) {
  const styles = useStyles2(getStyles);

  let disp = '';

  if (value instanceof Geometry) {
    disp = new WKT().writeGeometry(value, {
      featureProjection: 'EPSG:3857',
      dataProjection: 'EPSG:4326',
    });
  } else if (value != null) {
    disp = `${value}`;
  }

  return (
    <div className={styles.cell} style={{ justifyContent, height }}>
      <div className={styles.cellText} style={{ fontFamily: 'monospace' }}>
        {disp}
      </div>
    </div>
  );
}

const getStyles = () => ({
  cell: css({
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    padding: '0 8px',
  }),
  cellText: css({
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  }),
});
