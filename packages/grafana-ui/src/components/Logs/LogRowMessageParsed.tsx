import React, { PureComponent } from 'react';
import { LogRowModel } from '@grafana/data';

import { Themeable } from '../../types/theme';
import { withTheme } from '../../themes/index';

import { parseMessage } from './logParser';

export interface Props extends Themeable {
  row: LogRowModel;
  showParsedFields: string[];
}

class UnThemedLogRowMessageParsed extends PureComponent<Props> {
  render() {
    const { row, showParsedFields } = this.props;
    const fields = parseMessage(row.entry);

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
