import { css } from '@emotion/css';
import React from 'react';

import { LogRowModel, Field, LinkModel, DataFrame } from '@grafana/data';

import { LogRowMenuCell } from './LogRowMenuCell';
import { LogRowStyles } from './getLogRowStyles';
import { getAllFields } from './logParser';

export interface Props {
  row: LogRowModel;
  detectedFields: string[];
  wrapLogMessage: boolean;
  getFieldLinks?: (field: Field, rowIndex: number, dataFrame: DataFrame) => Array<LinkModel<Field>>;
  styles: LogRowStyles;
  showContextToggle?: (row?: LogRowModel) => boolean;
  onOpenContext: (row: LogRowModel) => void;
  onPermalinkClick?: (row: LogRowModel) => Promise<void>;
  onPinLine?: (row: LogRowModel) => void;
  onUnpinLine?: (row: LogRowModel) => void;
  pinned?: boolean;
}

export const LogRowMessageDisplayedFields = React.memo((props: Props) => {
  const { row, detectedFields, getFieldLinks, wrapLogMessage, styles, ...rest } = props;
  const fields = getAllFields(row, getFieldLinks);
  const wrapClassName = wrapLogMessage ? '' : displayedFieldsStyles.noWrap;
  // only single key/value rows are filterable, so we only need the first field key for filtering
  const line = detectedFields
    .map((parsedKey) => {
      const field = fields.find((field) => {
        const { keys } = field;
        return keys[0] === parsedKey;
      });

      if (field !== undefined && field !== null) {
        return `${parsedKey}=${field.values}`;
      }

      if (row.labels[parsedKey] !== undefined && row.labels[parsedKey] !== null) {
        return `${parsedKey}=${row.labels[parsedKey]}`;
      }

      return null;
    })
    .filter((s) => s !== null)
    .join(' ');

  return (
    <>
      <td className={styles.logsRowMessage}>
        <div className={wrapClassName}>{line}</div>
      </td>
      <td className={`log-row-menu-cell ${styles.logRowMenuCell}`}>
        <LogRowMenuCell logText={line} row={row} styles={styles} {...rest} />
      </td>
    </>
  );
});

const displayedFieldsStyles = {
  noWrap: css`
    white-space: nowrap;
  `,
};

LogRowMessageDisplayedFields.displayName = 'LogRowMessageDisplayedFields';
