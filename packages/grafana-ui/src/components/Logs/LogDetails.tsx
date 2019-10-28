import React, { PureComponent } from 'react';
import { LogsParser, getParser, LogRowModel } from '@grafana/data';

import { Themeable } from '../../types/theme';
import { withTheme } from '../../themes/index';
import { getLogRowStyles } from './getLogRowStyles';

//Components
import { LogDetailsRow } from './LogDetailsRow';

interface Props extends Themeable {
  row: LogRowModel;
  getRows: () => LogRowModel[];
  onClickFilterLabel?: (key: string, value: string) => void;
  onClickFilterOutLabel?: (key: string, value: string) => void;
}

interface State {
  parsed: boolean;
  parsedFieldHighlights: string[];
  parser?: LogsParser;
}

class UnThemedLogDetails extends PureComponent<Props, State> {
  state: State = {
    parsed: false,
    parser: undefined,
    parsedFieldHighlights: [],
  };

  parseMessage() {
    const { row } = this.props;
    const parser = getParser(row.entry);
    if (parser) {
      // Use parser to highlight detected fields
      const parsedFieldHighlights = parser.getFields(row.entry);
      this.setState({ parsedFieldHighlights, parsed: true, parser });
    }
  }

  componentDidMount() {
    this.parseMessage();
  }

  render() {
    const { row, theme, onClickFilterOutLabel, onClickFilterLabel, getRows } = this.props;
    const { parsedFieldHighlights, parser } = this.state;
    const style = getLogRowStyles(theme, row.logLevel);
    const labels = row.labels ? row.labels : {};
    const noDetailsAvailable = Object.keys(labels).length === 0 && parsedFieldHighlights.length === 0;

    return (
      <div className={style.logsRowCell}>
        <div className={style.logsRowDetailsTable}>
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
                onClickFilterOutLabel={onClickFilterOutLabel}
                onClickFilterLabel={onClickFilterLabel}
              />
            );
          })}
          {parsedFieldHighlights && <div className={style.logsRowDetailsHeading}>Parsed fields:</div>}
          {parsedFieldHighlights &&
            parsedFieldHighlights.map(field => {
              const key = parser!.getLabelFromField(field);
              const value = parser!.getValueFromField(field);
              return (
                <LogDetailsRow
                  key={`${key}=${value}`}
                  parsedKey={key}
                  parsedValue={value}
                  field={field}
                  row={row}
                  getRows={getRows}
                  parser={parser}
                />
              );
            })}
          {noDetailsAvailable && <div>No details available</div>}
        </div>
      </div>
    );
  }
}

export const LogDetails = withTheme(UnThemedLogDetails);
LogDetails.displayName = 'LogDetails';
