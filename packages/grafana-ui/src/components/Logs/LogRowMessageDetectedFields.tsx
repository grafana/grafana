import React, { PureComponent } from 'react';
import { LogRowModel, Field, LinkModel } from '@grafana/data';

import { Themeable } from '../../types/theme';
import { withTheme } from '../../themes/index';

import { getAllFields } from './logParser';

export interface Props extends Themeable {
  row: LogRowModel;
  showDetectedFields: string[];
  getFieldLinks?: (field: Field, rowIndex: number) => Array<LinkModel<Field>>;
}

class UnThemedLogRowMessageDetectedFields extends PureComponent<Props> {
  render() {
    const { row, showDetectedFields, getFieldLinks } = this.props;
    const fields = getAllFields(row, getFieldLinks);

    const line = showDetectedFields
      .map(parsedKey => {
        const field = fields.find(field => {
          const { key } = field;
          return key === parsedKey;
        });

        if (field) {
          return `${parsedKey}=${field.value}`;
        }

        return null;
      })
      .filter(s => s !== null)
      .join(' ');

    return <td>{line}</td>;
  }
}

export const LogRowMessageDetectedFields = withTheme(UnThemedLogRowMessageDetectedFields);
LogRowMessageDetectedFields.displayName = 'LogRowMessageDetectedFields';
