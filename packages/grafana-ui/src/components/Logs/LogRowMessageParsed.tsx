import React, { PureComponent } from 'react';
import memoizeOne from 'memoize-one';
import { Field, getParser, LinkModel, LogRowModel } from '@grafana/data';

import { Themeable } from '../../types/theme';
import { withTheme } from '../../themes/index';

type FieldDef = {
  key: string;
  value: string;
  links?: Array<LinkModel<Field>>;
  fieldIndex?: number;
};

export interface Props extends Themeable {
  row: LogRowModel;
  showParsedFields: string[];
}

class UnThemedLogRowMessageParsed extends PureComponent<Props> {
  getParser = memoizeOne(getParser);

  parseMessage = memoizeOne((rowEntry): FieldDef[] => {
    const parser = this.getParser(rowEntry);
    if (!parser) {
      return [];
    }
    // Use parser to highlight detected fields
    const parsedFields = parser.getFields(rowEntry);
    const fields = parsedFields.map(field => {
      const key = parser.getLabelFromField(field);
      const value = parser.getValueFromField(field);
      return { key, value };
    });

    return fields;
  });

  render() {
    const { row, showParsedFields } = this.props;
    const fields = this.parseMessage(row.entry);

    return (
      <td>
        {showParsedFields.map(parsedKey => {
          const field = fields.find(field => {
            const { key } = field;
            return key === parsedKey;
          });

          if (field) {
            return `${parsedKey}=${field.value} `;
          }
          return '';
        })}
      </td>
    );
  }
}

export const LogRowMessageParsed = withTheme(UnThemedLogRowMessageParsed);
LogRowMessageParsed.displayName = 'LogRowMessageParsed';
