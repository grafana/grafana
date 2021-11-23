import React from 'react';
import { css } from '@emotion/css';
import { Tooltip } from '../Tooltip/Tooltip';
import { useStyles2 } from '../../themes';
import { TableCellProps } from './types';
import { GrafanaTheme2 } from '@grafana/data';

export function LogViewCell(props: TableCellProps): JSX.Element {
  const { cell, tableStyles, cellProps } = props;
  return (
    <Tooltip placement="auto-start" content={<LogTooltip value={cell.value} />} theme="info-alt">
      <div {...cellProps} className={tableStyles.cellContainer}>
        <div className={tableStyles.cellText}>{cell.value}</div>
      </div>
    </Tooltip>
  );
}

interface PopupProps {
  value: any;
}

function LogTooltip(props: PopupProps): JSX.Element {
  const styles = useStyles2(getStyles);
  return (
    <div className={styles.container}>
      <div className={styles.content}>{props.value}</div>
    </div>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    container: css`
      padding: ${theme.spacing(0.5)};
    `,
    content: css`
      width: fit-content;
      max-height: 70vh;
      overflow-y: auto;
    `,
  };
}
