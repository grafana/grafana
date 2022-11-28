import { cx } from '@emotion/css';
import React, { FC } from 'react';

import { useStyles2 } from '../../themes';
import { getCellLinks } from '../../utils';
import { clearLinkButtonStyles, LinkButton } from '../Button';
import { DataLinksContextMenu } from '../DataLinks/DataLinksContextMenu';

import { TableCellProps } from './types';

export const ImageCell: FC<TableCellProps> = (props) => {
  const { field, cell, tableStyles, row, cellProps } = props;

  const displayValue = field.display!(cell.value);

  const hasLinks = Boolean(getCellLinks(field, row)?.length);
  const clearButtonStyle = useStyles2(clearLinkButtonStyles);

  return (
    <div {...cellProps} className={tableStyles.cellContainer}>
      {!hasLinks && <img src={displayValue.text} className={tableStyles.imageCell} alt="" />}
      {hasLinks && (
        <DataLinksContextMenu links={() => getCellLinks(field, row) || []}>
          {(api) => {
            return (
              <LinkButton
                onClick={api.openMenu}
                className={cx(tableStyles.imageCellLink, api.targetClassName, clearButtonStyle)}
              >
                <img src={displayValue.text} className={tableStyles.imageCell} alt="" />
              </LinkButton>
            );
          }}
        </DataLinksContextMenu>
      )}
    </div>
  );
};
