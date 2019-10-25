import React, { PureComponent } from 'react';
import { LogRowModel } from '@grafana/data';
import { cx } from 'emotion';
import { Themeable } from '../../types/theme';
import { withTheme } from '../../themes/index';
import { getLogRowStyles } from './getLogRowStyles';
import { LogLabelStatsModel, LogsParser, getParser } from '@grafana/data';

interface Props extends Themeable {
  row: LogRowModel;
  getRows: () => LogRowModel[];
  onClickFilterLabel?: (key: string, value: string) => void;
  onClickFilterOutLabel?: (key: string, value: string) => void;
}

interface State {
  fieldCount: number;
  fieldLabel: string | null;
  fieldStats: LogLabelStatsModel[] | null;
  fieldValue: string | null;
  parsed: boolean;
  parser?: LogsParser;
  parsedFieldHighlights: string[];
  showFieldStats: boolean;
}

class UnThemedLogDetails extends PureComponent<Props, State> {
  state: State = {
    fieldCount: 0,
    fieldLabel: null,
    fieldStats: null,
    fieldValue: null,
    parsed: false,
    parser: undefined,
    parsedFieldHighlights: [],
    showFieldStats: false,
  };

  // const { getRows, onClickLabel } = props;
  /* <LogLabels getRows={getRows} labels={row.uniqueLabels ? row.uniqueLabels : {}} onClickLabel={onClickLabel} /> */

  filterLabel = (label: string, value: string) => {
    const { onClickFilterLabel } = this.props;
    if (onClickFilterLabel) {
      onClickFilterLabel(label, value);
    }
  };

  filterOutLabel = (label: string, value: string) => {
    const { onClickFilterOutLabel } = this.props;
    if (onClickFilterOutLabel) {
      onClickFilterOutLabel(label, value);
    }
  };

  parseMessage = () => {
    const { row } = this.props;
    console.log('row.entry', row.entry);
    const parser = getParser(row.entry);
    if (parser) {
      // Use parser to highlight detected fields
      const parsedFieldHighlights = parser.getFields(row.entry);
      this.setState({ parsedFieldHighlights, parsed: true, parser });
    }
  };

  findKeyLabel = (field: string, idx: number) => {
    const labelMatch = field.match(/^(.*?)=/);
    const keyMatch = field.match(/=(.+)/);
    const key: string = labelMatch ? labelMatch[1] : '';
    const label: string = keyMatch ? keyMatch[1] : '';
    return { key, label };
  };

  componentDidMount() {
    this.parseMessage();
  }

  render() {
    const { row, theme } = this.props;
    const { parsedFieldHighlights } = this.state;
    const style = getLogRowStyles(theme, row.logLevel);
    const labels = row.labels ? row.labels : {};
    return (
      <>
        <div className={cx([style.logsRowDetailsTable])}>
          {Object.keys(labels).map(key => {
            const label = labels[key];
            return (
              <div key={key} className={cx([style.logsRowDetailsRow])}>
                <div onClick={() => alert('metrics')} className={cx([style.logsRowDetailsIcon])}>
                  <i className={'fa fa-signal'} />
                </div>
                <div onClick={() => this.filterLabel(key, label)} className={cx([style.logsRowDetailsIcon])}>
                  <i className={'fa fa-search-plus'} />
                </div>
                <div onClick={() => this.filterOutLabel(key, label)} className={cx([style.logsRowDetailsIcon])}>
                  <i className={'fa fa-search-minus'} />
                </div>
                <div className={cx([style.logsRowDetailsLabel])}>{key}</div>
                <div className={cx([style.logsRowCell])}>{label}</div>
              </div>
            );
          })}
          {parsedFieldHighlights &&
            parsedFieldHighlights.map((field, idx) => {
              if (this.findKeyLabel(field, idx)) {
                const { key, label } = this.findKeyLabel(field, idx);
                return (
                  <div key={key} className={cx([style.logsRowDetailsRow])}>
                    <div onClick={() => alert('metrics')} className={cx([style.logsRowDetailsIcon])}>
                      <i className={'fa fa-signal'} />
                    </div>
                    <div onClick={() => this.filterLabel(key, label)} className={cx([style.logsRowDetailsIcon])}>
                      <i className={'fa fa-search-plus'} />
                    </div>
                    <div onClick={() => this.filterOutLabel(key, label)} className={cx([style.logsRowDetailsIcon])}>
                      <i className={'fa fa-search-minus'} />
                    </div>
                    <div className={cx([style.logsRowDetailsLabel])}>{key}</div>
                    <div className={cx([style.logsRowCell])}>{label}</div>
                  </div>
                );
              } else {
                return <div />;
              }
            })}
        </div>
      </>
    );
  }
}

export const LogDetails = withTheme(UnThemedLogDetails);
LogDetails.displayName = 'LogDetails';
