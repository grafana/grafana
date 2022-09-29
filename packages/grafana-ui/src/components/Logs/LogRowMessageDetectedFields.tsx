import { css } from '@emotion/css';
import React, { PureComponent } from 'react';

import { LogRowModel, Field, LinkModel } from '@grafana/data';

import { withTheme2 } from '../../themes/index';
import { Themeable2 } from '../../types/theme';

import { getAllFields } from './logParser';

/** @deprecated will be removed in the next major version */
export interface Props extends Themeable2 {
  row: LogRowModel;
  showDetectedFields: string[];
  wrapLogMessage: boolean;
  getFieldLinks?: (field: Field, rowIndex: number) => Array<LinkModel<Field>>;
}

class UnThemedLogRowMessageDetectedFields extends PureComponent<Props> {
  render() {
    const { row, showDetectedFields, getFieldLinks, wrapLogMessage } = this.props;
    const fields = getAllFields(row, getFieldLinks);
    const wrapClassName = wrapLogMessage
      ? ''
      : css`
          white-space: nowrap;
        `;

    const line = showDetectedFields
      .map((parsedKey) => {
        const field = fields.find((field) => {
          const { key } = field;
          return key === parsedKey;
        });

        if (field) {
          return `${parsedKey}=${field.value}`;
        }

        return null;
      })
      .filter((s) => s !== null)
      .join(' ');

    return <td className={wrapClassName}>{line}</td>;
  }
}

/** @deprecated will be removed in the next major version */
export const LogRowMessageDetectedFields = withTheme2(UnThemedLogRowMessageDetectedFields);
LogRowMessageDetectedFields.displayName = 'LogRowMessageDetectedFields';
