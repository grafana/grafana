import { cx } from '@emotion/css';
import React, { FC } from 'react';

import { getCellLinks } from '../../utils';
import { DataLinksContextMenu } from '../DataLinks/DataLinksContextMenu';

import { TableCellProps } from './types';

export const ImageCell: FC<TableCellProps> = (props) => {
  const { field, cell, tableStyles, row, cellProps } = props;

  const displayValue = field.display!(cell.value);

  const hasLinks = Boolean(getCellLinks(field, row)?.length);

  return (
    <div {...cellProps} className={tableStyles.cellContainer}>
      {!hasLinks && <img src={displayValue.text} className={tableStyles.imageCell} alt="" />}
      {hasLinks && (
        <DataLinksContextMenu links={() => getCellLinks(field, row) || []}>
          {(api) => {
            return (
              <div onClick={api.openMenu} className={cx(tableStyles.imageCellLink, api.targetClassName)}>
                <img src={displayValue.text} className={tableStyles.imageCell} alt="" />
              </div>
            );
          }}
        </DataLinksContextMenu>
      )}
    </div>
  );
};
