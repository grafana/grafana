import React, { PureComponent } from 'react';
import { LogsParser, getParser, LogRowModel } from '@grafana/data';

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

interface State {
  parsed: boolean;
  parsedFields: string[];
  parser?: LogsParser;
}

class UnThemedLogDetails extends PureComponent<Props, State> {
  state: State = {
    parsed: false,
    parser: undefined,
    parsedFields: [],
  };

  parseMessage() {
    const { row } = this.props;
    const parser = getParser(row.entry);
    if (parser) {
      // Use parser to highlight detected fields
      const parsedFields = parser.getFields(row.entry);
      this.setState({ parsedFields, parsed: true, parser });
    }
  }

  componentDidMount() {
    this.parseMessage();
  }

  render() {
    const { row, theme, onClickFilterOutLabel, onClickFilterLabel, getRows } = this.props;
    const { parsedFields, parser } = this.state;
    const style = getLogRowStyles(theme, row.logLevel);
    const labels = row.labels ? row.labels : {};
    const labelsAvailable = Object.keys(labels).length > 0;
    const parsedFieldsAvailable = parsedFields.length > 0;

    return (
      <div className={style.logsRowDetailsTable}>
        {labelsAvailable && (
          <div className={style.logsRowDetailsSectionTable}>
            <div className={style.logsRowDetailsHeading}>Log Labels:</div>
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
                  parser={parser}
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
            <div className={style.logsRowDetailsHeading}>Parsed fields:</div>
            {parsedFields.map(field => {
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
        {!parsedFieldsAvailable && !labelsAvailable && <div>No details available</div>}
      </div>
    );
  }
}

export const LogDetails = withTheme(UnThemedLogDetails);
LogDetails.displayName = 'LogDetails';
