import { cx } from '@emotion/css';
import React from 'react';

import { useStyles2 } from '../../themes';
import { getCellLinks } from '../../utils';
import { Button, clearLinkButtonStyles } from '../Button';
import { DataLinksContextMenu } from '../DataLinks/DataLinksContextMenu';

import { TableCellProps } from './types';

export const ImageCell = (props: TableCellProps) => {
  const { field, cell, tableStyles, row, cellProps } = props;

  const displayValue = field.display!(cell.value);

  const hasLinks = Boolean(getCellLinks(field, row)?.length);
  const clearButtonStyle = useStyles2(clearLinkButtonStyles);

  return (
    <div {...cellProps} className={tableStyles.cellContainer}>
      {!hasLinks && <img src={displayValue.text} className={tableStyles.imageCell} alt="" />}
      {hasLinks && (
        <DataLinksContextMenu style={{ height: '100%' }} links={() => getCellLinks(field, row) || []}>
          {(api) => {
            const img = <img src={displayValue.text} className={tableStyles.imageCell} alt="" />;
            if (api.openMenu) {
              return (
                <Button className={cx(clearButtonStyle)} onClick={api.openMenu}>
                  {img}
                </Button>
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
