import React, { PureComponent } from 'react';
import { LogRowModel } from '@grafana/data';
import { cx } from 'emotion';
import { Themeable } from '../../types/theme';
import { withTheme } from '../../themes/index';
import { getLogRowStyles } from './getLogRowStyles';
import { LogsParser, getParser } from '@grafana/data';
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
  showFieldStats: boolean;
}

class UnThemedLogDetails extends PureComponent<Props, State> {
  state: State = {
    parsed: false,
    parser: undefined,
    parsedFieldHighlights: [],
    showFieldStats: false,
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

  findKeyLabel = (field: string) => {
    const keyMatch = field.match(/^(.*?)=/);
    const valueMatch = field.match(/=(.+)/);
    const value = valueMatch ? valueMatch[1] : '';
    const key = keyMatch ? keyMatch[1] : '';
    return { key, value };
  };

  componentDidMount() {
    this.parseMessage();
  }

  render() {
    const { row, theme, onClickFilterOutLabel, onClickFilterLabel } = this.props;
    const { parsedFieldHighlights } = this.state;
    const style = getLogRowStyles(theme, row.logLevel);
    const labels = row.labels ? row.labels : {};
    return (
      <div className={cx([style.logsRowDetailsTable])}>
        {Object.keys(labels).map(key => {
          const value = labels[key];
          return (
            <LogDetailsRow
              keyDetail={key}
              value={value}
              canShowMetrics={false}
              canFilter={true}
              canFilterOut={true}
              onClickFilterOutLabel={onClickFilterOutLabel}
              onClickFilterLabel={onClickFilterLabel}
            />
          );
        })}
        {parsedFieldHighlights &&
          parsedFieldHighlights.map(field => {
            const { key, value } = this.findKeyLabel(field);
            return (
              <LogDetailsRow
                keyDetail={key}
                value={value}
                canShowMetrics={true}
                canFilter={false}
                canFilterOut={false}
                onClickFilterOutLabel={onClickFilterOutLabel}
                onClickFilterLabel={onClickFilterLabel}
              />
            );
          })}
      </div>
    );
  }
}

export const LogDetails = withTheme(UnThemedLogDetails);
LogDetails.displayName = 'LogDetails';
