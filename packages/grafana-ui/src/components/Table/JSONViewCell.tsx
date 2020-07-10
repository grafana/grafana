import React, { FC } from 'react';
import { css, cx } from 'emotion';
import { isString } from 'lodash';
import { Tooltip } from '../Tooltip/Tooltip';
import { JSONFormatter } from '../JSONFormatter/JSONFormatter';
import { useStyles } from '../../themes';
import { TableCellProps } from './types';
import { GrafanaTheme } from '@grafana/data';

export const JSONViewCell: FC<TableCellProps> = props => {
  const { field, cell, tableStyles } = props;

  if (!field.display) {
    return null;
  }

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
    displayValue = JSON.stringify(value);
  }
  const content = <JSONTooltip value={value} />;
  return (
    <div className={cx(txt, tableStyles.tableCell)}>
      <Tooltip placement="auto" content={content} theme="info-alt">
        <div className={tableStyles.overflow}>{displayValue}</div>
      </Tooltip>
    </div>
  );
};

interface PopupProps {
  value: any;
}

const JSONTooltip: FC<PopupProps> = props => {
  const styles = useStyles((theme: GrafanaTheme) => {
    return {
      container: css`
        padding: ${theme.spacing.xs};
      `,
    };
  });

  return (
    <div className={styles.container}>
      <div>
        <JSONFormatter json={props.value} open={4} />
      </div>
    </div>
  );
};
