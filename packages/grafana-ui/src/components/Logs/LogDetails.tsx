import React, { PureComponent } from 'react';
import memoizeOne from 'memoize-one';
import { getParser, LogRowModel, LogsParser } from '@grafana/data';

import { Themeable } from '../../types/theme';
import { withTheme } from '../../themes/index';
import { getLogRowStyles } from './getLogRowStyles';

//Components
import { LogDetailsRow } from './LogDetailsRow';

export interface Props extends Themeable {
  row: LogRowModel;
  getRows: () => LogRowModel[];
  onClickFilterLabel?: (key: string, value: string) => void;
  onClickFilterOutLabel?: (key: string, value: string) => void;
}

class UnThemedLogDetails extends PureComponent<Props> {
  parseMessage = memoizeOne(
    (rowEntry): { parsedFields: string[]; parser?: LogsParser } => {
      const parser = getParser(rowEntry);
      if (!parser) {
        return { parsedFields: [] };
      }
      // Use parser to highlight detected fields
      const parsedFields = parser.getFields(rowEntry);
      return { parsedFields, parser };
    }
  );

  render() {
    const { row, theme, onClickFilterOutLabel, onClickFilterLabel, getRows } = this.props;
    const style = getLogRowStyles(theme, row.logLevel);
    const labels = row.labels ? row.labels : {};
    const labelsAvailable = Object.keys(labels).length > 0;
    const { parsedFields, parser } = this.parseMessage(row.entry);
    const parsedFieldsAvailable = parsedFields && parsedFields.length > 0;

    return (
      <div className={style.logsRowDetailsTable}>
        {labelsAvailable && (
          <div className={style.logsRowDetailsSectionTable}>
            <div className={style.logsRowDetailsHeading} aria-label="Log labels">
              Log Labels:
            </div>
            {Object.keys(labels).map(key => {
              const value = labels[key];
              const field = `${key}=${value}`;
              return (
                <LogDetailsRow
                  key={`${key}=${value}`}
                  parsedKey={key}
                  parsedValue={value}
                  field={field}
                  row={row}
                  getRows={getRows}
                  isLabel={true}
                  onClickFilterOutLabel={onClickFilterOutLabel}
                  onClickFilterLabel={onClickFilterLabel}
                />
              );
            })}
          </div>
        )}

        {parsedFieldsAvailable && (
          <div className={style.logsRowDetailsSectionTable}>
            <div className={style.logsRowDetailsHeading} aria-label="Parsed fields">
              Parsed fields:
            </div>
            {parsedFields &&
              parsedFields.map(field => {
                const key = parser!.getLabelFromField(field);
                const value = parser!.getValueFromField(field);
                return (
                  <LogDetailsRow
                    key={`${key}=${value}`}
                    parsedKey={key}
                    parsedValue={value}
                    field={field}
                    row={row}
                    isLabel={false}
                    getRows={getRows}
                    parser={parser}
                  />
                );
              })}
          </div>
        )}
        {!parsedFieldsAvailable && !labelsAvailable && <div aria-label="No details">No details available</div>}
      </div>
    );
  }
}

export const LogDetails = withTheme(UnThemedLogDetails);
LogDetails.displayName = 'LogDetails';
