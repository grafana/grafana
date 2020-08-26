import React, { PureComponent } from 'react';
import { LogRowModel, Field, LinkModel } from '@grafana/data';

import { Themeable } from '../../types/theme';
import { withTheme } from '../../themes/index';

import { getAllFields } from './logParser';

export interface Props extends Themeable {
  row: LogRowModel;
  showParsedFields: string[];
  getFieldLinks?: (field: Field, rowIndex: number) => Array<LinkModel<Field>>;
}

class UnThemedLogRowMessageParsed extends PureComponent<Props> {
  render() {
    const { row, showParsedFields, getFieldLinks } = this.props;
    const fields = getAllFields(row, getFieldLinks);

    const line = showParsedFields
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

export const LogRowMessageParsed = withTheme(UnThemedLogRowMessageParsed);
LogRowMessageParsed.displayName = 'LogRowMessageParsed';
