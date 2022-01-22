import React from 'react';
import { css, cx } from '@emotion/css';
import { TableCellProps } from './types';
import { Geometry } from 'ol/geom';
import WKT from 'ol/format/WKT';

export function GeoCell(props: TableCellProps): JSX.Element {
  const { cell, tableStyles, cellProps } = props;

  const txt = css`
    font-family: monospace;
  `;

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
      <div className={cx(tableStyles.cellText, txt)}>{disp}</div>
    </div>
  );
}
