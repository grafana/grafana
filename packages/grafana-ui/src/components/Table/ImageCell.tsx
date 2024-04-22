import { cx } from '@emotion/css';
import React from 'react';

import { useStyles2 } from '../../themes';
import { getCellLinks } from '../../utils';
import { DataLinksContextMenu } from '../DataLinks/DataLinksContextMenu';

import { TableCellProps } from './types';

const DATALINKS_HEIGHT_OFFSET = 10;

export const ImageCell = (props: TableCellProps) => {
  const { field, cell, tableStyles, row, cellProps } = props;

  const displayValue = field.display!(cell.value);

  const hasLinks = Boolean(getCellLinks(field, row)?.length);

  return (
    <div {...cellProps} className={tableStyles.cellContainer}>
      {!hasLinks && <img src={displayValue.text} className={tableStyles.imageCell} alt="" />}
      {hasLinks && (
        <DataLinksContextMenu
          style={{ height: tableStyles.cellHeight - DATALINKS_HEIGHT_OFFSET, width: 'auto' }}
          links={() => getCellLinks(field, row) || []}
        >
          {(api) => {
            const img = <img style={{ height: tableStyles.cellHeight - DATALINKS_HEIGHT_OFFSET, width: 'auto' }} src={displayValue.text} className={tableStyles.imageCell} alt="" />;
            if (api.openMenu) {
              return (
                <a onClick={api.openMenu}>
                  {img}
                </a>
              );
            } else {
              return img;
            }
          }}
        </DataLinksContextMenu>
      )}
    </div>
  );
};
