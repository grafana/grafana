import { cx } from '@emotion/css';
import React from 'react';

import { textUtil } from '@grafana/data';

import { useStyles2 } from '../../themes';
import { getCellLinks } from '../../utils';
import { Button, clearLinkButtonStyles } from '../Button';
import { DataLinksContextMenu } from '../DataLinks/DataLinksContextMenu';

import { TableCellProps } from './types';

export function StringCell(props: TableCellProps): JSX.Element {
  const { cell, tableStyles, cellProps, field, row } = props;

  const sanitizeHTML = field.config.custom?.cellOptions.sanitizeHTML;
  const hasLinks = Boolean(getCellLinks(field, row)?.length);
  const clearButtonStyle = useStyles2(clearLinkButtonStyles);
  const content = sanitizeHTML ? (
    <div dangerouslySetInnerHTML={{ __html: textUtil.sanitize(cell.value) }} />
  ) : (
    <div>{cell.value}</div>
  );

  return (
    <div {...cellProps} className={tableStyles.cellContainer}>
      <div className={cx(tableStyles.cellText)}>
        {!hasLinks && <div className={tableStyles.cellText}>{content}</div>}
        {hasLinks && (
          <DataLinksContextMenu links={() => getCellLinks(field, row) || []}>
            {(api) => {
              if (api.openMenu) {
                return (
                  <Button className={cx(clearButtonStyle)} onClick={api.openMenu}>
                    {content}
                  </Button>
                );
              } else {
                return <>{content}</>;
              }
            }}
          </DataLinksContextMenu>
        )}
      </div>
    </div>
  );
}
