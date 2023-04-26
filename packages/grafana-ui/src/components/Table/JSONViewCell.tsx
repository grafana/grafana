import { css, cx } from '@emotion/css';
import { isString } from 'lodash';
import React from 'react';

import { useStyles2 } from '../../themes';
import { getCellLinks } from '../../utils';
import { Button, clearLinkButtonStyles } from '../Button';
import { DataLinksContextMenu } from '../DataLinks/DataLinksContextMenu';

import { CellActions } from './CellActions';
import { TableCellProps, TableFieldOptions } from './types';

export function JSONViewCell(props: TableCellProps): JSX.Element {
  const { cell, tableStyles, cellProps, field, row } = props;
  const inspectEnabled = Boolean((field.config.custom as TableFieldOptions)?.inspect);
  const txt = css`
    cursor: pointer;
    font-family: monospace;
  `;

  let value = cell.value;
  let displayValue = value;

  if (isString(value)) {
    try {
      value = JSON.parse(value);
    } catch {} // ignore errors
  } else {
    displayValue = JSON.stringify(value, null, ' ');
  }

  const hasLinks = Boolean(getCellLinks(field, row)?.length);
  const clearButtonStyle = useStyles2(clearLinkButtonStyles);

  return (
    <div {...cellProps} className={inspectEnabled ? tableStyles.cellContainerNoOverflow : tableStyles.cellContainer}>
      <div className={cx(tableStyles.cellText, txt)}>
        {!hasLinks && <div className={tableStyles.cellText}>{displayValue}</div>}
        {hasLinks && (
          <DataLinksContextMenu links={() => getCellLinks(field, row) || []}>
            {(api) => {
              if (api.openMenu) {
                return (
                  <Button className={cx(clearButtonStyle)} onClick={api.openMenu}>
                    {displayValue}
                  </Button>
                );
              } else {
                return <>{displayValue}</>;
              }
            }}
          </DataLinksContextMenu>
        )}
      </div>
      {inspectEnabled && <CellActions {...props} previewMode="code" />}
    </div>
  );
}
