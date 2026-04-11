import { css } from '@emotion/css';

import { useOpenLayersContext } from '../../OpenLayersContext';
import { type GeoCellProps, type TableCellStyles } from '../types';

export function GeoCell({ value }: GeoCellProps) {
  const { formatGeometry } = useOpenLayersContext();
  let disp = null;

  if (
    formatGeometry &&
    // alternative to instanceof Geometry without importing the whole class from ol
    typeof value === 'object' &&
    value != null &&
    'intersectsCoordinate' in value
  ) {
    // @ts-ignore
    disp = formatGeometry(value);
  } else if (value != null) {
    disp = `${value}`;
  }

  return disp;
}

const styles = css({
  fontFamily: 'monospace',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
});

export const getStyles: TableCellStyles = () => styles;
