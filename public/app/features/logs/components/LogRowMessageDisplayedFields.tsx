import { css } from '@emotion/css';
import React from 'react';

import { LogRowModel, Field, LinkModel, DataFrame } from '@grafana/data';

import { getAllFields } from './logParser';

export interface Props {
  row: LogRowModel;
  showDetectedFields: string[];
  wrapLogMessage: boolean;
  getFieldLinks?: (field: Field, rowIndex: number, dataFrame: DataFrame) => Array<LinkModel<Field>>;
}

export const LogRowMessageDisplayedFields = React.memo((props: Props) => {
  const { row, showDetectedFields, getFieldLinks, wrapLogMessage } = props;
  const fields = getAllFields(row, getFieldLinks);
  const wrapClassName = wrapLogMessage ? '' : styles.noWrap;
  // only single key/value rows are filterable, so we only need the first field key for filtering
  const line = showDetectedFields
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

  return <td className={wrapClassName}>{line}</td>;
});

const styles = {
  noWrap: css`
    white-space: nowrap;
  `,
};

LogRowMessageDisplayedFields.displayName = 'LogRowMessageDisplayedFields';
