import React, { PureComponent } from 'react';
import memoizeOne from 'memoize-one';
import { css, cx } from 'emotion';
import { Field, getParser, LinkModel, LogRowModel } from '@grafana/data';

import { Themeable } from '../../types/theme';
import { withTheme } from '../../themes/index';

//Components
import { LogDetailsRow } from './LogDetailsRow';

type FieldDef = {
  key: string;
  value: string;
  links?: Array<LinkModel<Field>>;
  fieldIndex?: number;
};

export interface Props extends Themeable {
  row: LogRowModel;
  showParsedFields: Array<string>;
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
    const { row, theme, showParsedFields } = this.props;
    const fields = this.parseMessage(row.entry);

    return (
      <td>
        {showParsedFields.map(parsedKey => {
          const field = fields.find(field => {
            const { key, value, links, fieldIndex } = field;
            return key === parsedKey;
          });

          if (field) {
            return `${parsedKey}=${field.value} `;
          }
        })}
      </td>
    );
  }
}

export const LogRowMessageParsed = withTheme(UnThemedLogRowMessageParsed);
LogRowMessageParsed.displayName = 'LogRowMessageParsed';
