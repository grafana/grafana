import { css } from '@emotion/css';
import React, { PureComponent } from 'react';

import { LogRowModel, Field, LinkModel, DataFrame } from '@grafana/data';
import { withTheme2, Themeable2 } from '@grafana/ui';

import { getAllFields } from './logParser';

export interface Props extends Themeable2 {
  row: LogRowModel;
  showDetectedFields: string[];
  wrapLogMessage: boolean;
  getFieldLinks?: (field: Field, rowIndex: number, dataFrame: DataFrame) => Array<LinkModel<Field>>;
}

class UnThemedLogRowMessageDisplayedFields extends PureComponent<Props> {
  render() {
    const { row, showDetectedFields, getFieldLinks, wrapLogMessage } = this.props;
    const fields = getAllFields(row, getFieldLinks);
    const wrapClassName = wrapLogMessage
      ? ''
      : css`
          white-space: nowrap;
        `;
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
  }
}

export const LogRowMessageDisplayedFields = withTheme2(UnThemedLogRowMessageDisplayedFields);
LogRowMessageDisplayedFields.displayName = 'LogRowMessageDisplayedFields';
