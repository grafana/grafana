import React from 'react';
import { css, cx } from '@emotion/css';
import { isString } from 'lodash';
import { Tooltip } from '../Tooltip/Tooltip';
import { JSONFormatter } from '../JSONFormatter/JSONFormatter';
import { useStyles2 } from '../../themes';
import { TableCellProps } from './types';
import { GrafanaTheme2 } from '@grafana/data';

export function JSONViewCell(props: TableCellProps): JSX.Element {
  const { cell, tableStyles, cellProps } = props;

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

  const content = <JSONTooltip value={value} />;

  return (
    <Tooltip placement="auto-start" content={content} theme="info-alt">
      <div {...cellProps} className={tableStyles.cellContainer}>
        <div className={cx(tableStyles.cellText, txt)}>{displayValue}</div>
      </div>
    </Tooltip>
  );
}

interface PopupProps {
  value: any;
}

function JSONTooltip(props: PopupProps): JSX.Element {
  const styles = useStyles2(getStyles);
  return (
    <div className={styles.container}>
      <div>
        <JSONFormatter json={props.value} open={4} className={styles.json} />
      </div>
    </div>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    container: css`
      padding: ${theme.spacing(0.5)};
    `,
    json: css`
      width: fit-content;
      max-height: 70vh;
      overflow-y: auto;
    `,
  };
}
