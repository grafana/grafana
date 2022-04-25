import { css, cx } from '@emotion/css';
import { isString } from 'lodash';
import React from 'react';

import { getCellLinks } from '../../utils';

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

  const { link, onClick } = getCellLinks(field, row);

  return (
    <div {...cellProps} className={inspectEnabled ? tableStyles.cellContainerNoOverflow : tableStyles.cellContainer}>
      <div className={cx(tableStyles.cellText, txt)}>
        {!link && <div className={tableStyles.cellText}>{displayValue}</div>}
        {link && (
          <a
            href={link.href}
            onClick={onClick}
            target={link.target}
            title={link.title}
            className={tableStyles.cellLink}
          >
            {displayValue}
          </a>
        )}
      </div>
      {inspectEnabled && <CellActions {...props} previewMode="code" />}
    </div>
  );
}
