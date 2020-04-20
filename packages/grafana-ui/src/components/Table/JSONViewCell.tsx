import React, { FC } from 'react';
import { css, cx } from 'emotion';
import { TableCellProps } from './types';
import { Tooltip } from '../Tooltip/Tooltip';
import { JSONFormatter } from '../JSONFormatter/JSONFormatter';

export const JSONViewCell: FC<TableCellProps> = props => {
  const { field, cell, tableStyles } = props;

  if (!field.display) {
    return null;
  }

  const txt = css`
    cursor: pointer;
    font-family: monospace;
  `;

  const displayValue = JSON.stringify(cell.value);
  const content = <JSONTooltip {...props} />;
  return (
    <div className={cx(txt, tableStyles.tableCell)}>
      <Tooltip placement="auto" content={content} theme={'info'}>
        <span>{displayValue}</span>
      </Tooltip>
    </div>
  );
};

const JSONTooltip: FC<TableCellProps> = props => {
  const { cell } = props;

  const clazz = css`
    padding: 10px;
  `;
  return (
    <div>
      <JSONFormatter json={cell.value} open={4} />
    </div>
  );
};
