import React, { PureComponent } from 'react';
import { cx } from 'emotion';
import { Themeable } from '../../types/theme';
import { withTheme } from '../../themes/index';
import { getLogRowStyles } from './getLogRowStyles';
import { LogsParser, getParser, LogRowModel } from '@grafana/data';
import { LogDetailsRow } from './LogDetailsRow';

interface Props extends Themeable {
  row: LogRowModel;
  getRows: () => LogRowModel[];
  onClickFilterLabel?: (key: string, value: string) => void;
  onClickFilterOutLabel?: (key: string, value: string) => void;
}

interface State {
  parsed: boolean;
  parser?: LogsParser;
  parsedFieldHighlights: string[];
}

class UnThemedLogDetails extends PureComponent<Props, State> {
  state: State = {
    parsed: false,
    parser: undefined,
    parsedFieldHighlights: [],
  };

  parseMessage = () => {
    const { row } = this.props;
    const parser = getParser(row.entry);
    if (parser) {
      // Use parser to highlight detected fields
      const parsedFieldHighlights = parser.getFields(row.entry);
      this.setState({ parsedFieldHighlights, parsed: true, parser });
    }
  };

  componentDidMount() {
    this.parseMessage();
  }

  render() {
    const { row, theme, onClickFilterOutLabel, onClickFilterLabel, getRows } = this.props;
    const { parsedFieldHighlights, parser } = this.state;
    const style = getLogRowStyles(theme, row.logLevel);
    const labels = row.labels ? row.labels : {};
    return (
      <div className={cx([style.logsRowDetailsTable])}>
        {Object.keys(labels).map(key => {
          const value = labels[key];
          return (
            <LogDetailsRow
              key={value}
              keyDetail={key}
              valueDetail={value}
              canFilter={true}
              canFilterOut={true}
              onClickFilterOutLabel={onClickFilterOutLabel}
              onClickFilterLabel={onClickFilterLabel}
            />
          );
        })}
        {parsedFieldHighlights &&
          parsedFieldHighlights.map(field => {
            const key = parser!.getLabelFromField(field);
            const value = parser!.getValueFromField(field);
            return (
              <LogDetailsRow
                key={value}
                keyDetail={key}
                valueDetail={value}
                canShowMetrics={true}
                field={field}
                row={row}
                getRows={getRows}
                parser={parser}
              />
            );
          })}
      </div>
    );
  }
}

export const LogDetails = withTheme(UnThemedLogDetails);
LogDetails.displayName = 'LogDetails';
