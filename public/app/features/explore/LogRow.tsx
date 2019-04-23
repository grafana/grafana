import React, { PureComponent } from 'react';
import _ from 'lodash';
import Highlighter from 'react-highlight-words';
import classnames from 'classnames';

import { LogRowModel, LogLabelStatsModel, LogsParser, calculateFieldStats, getParser } from 'app/core/logs_model';
import { LogLabels } from './LogLabels';
import { findHighlightChunksInText } from 'app/core/utils/text';
import { LogLabelStats } from './LogLabelStats';
import { LogMessageAnsi } from './LogMessageAnsi';

interface Props {
  highlighterExpressions?: string[];
  row: LogRowModel;
  showDuplicates: boolean;
  showLabels: boolean;
  showLocalTime: boolean;
  showUtc: boolean;
  getRows: () => LogRowModel[];
  onClickLabel?: (label: string, value: string) => void;
}

interface State {
  fieldCount: number;
  fieldLabel: string;
  fieldStats: LogLabelStatsModel[];
  fieldValue: string;
  parsed: boolean;
  parser?: LogsParser;
  parsedFieldHighlights: string[];
  showFieldStats: boolean;
}

/**
 * Renders a highlighted field.
 * When hovering, a stats icon is shown.
 */
const FieldHighlight = onClick => props => {
  return (
    <span className={props.className} style={props.style}>
      {props.children}
      <span className="logs-row__field-highlight--icon fa fa-signal" onClick={() => onClick(props.children)} />
    </span>
  );
};

/**
 * Renders a log line.
 *
 * When user hovers over it for a certain time, it lazily parses the log line.
 * Once a parser is found, it will determine fields, that will be highlighted.
 * When the user requests stats for a field, they will be calculated and rendered below the row.
 */
export class LogRow extends PureComponent<Props, State> {
  mouseMessageTimer: NodeJS.Timer;

  state = {
    fieldCount: 0,
    fieldLabel: null,
    fieldStats: null,
    fieldValue: null,
    parsed: false,
    parser: undefined,
    parsedFieldHighlights: [],
    showFieldStats: false,
  };

  componentWillUnmount() {
    clearTimeout(this.mouseMessageTimer);
  }

  onClickClose = () => {
    this.setState({ showFieldStats: false });
  };

  onClickHighlight = (fieldText: string) => {
    const { getRows } = this.props;
    const { parser } = this.state;
    const allRows = getRows();

    // Build value-agnostic row matcher based on the field label
    const fieldLabel = parser.getLabelFromField(fieldText);
    const fieldValue = parser.getValueFromField(fieldText);
    const matcher = parser.buildMatcher(fieldLabel);
    const fieldStats = calculateFieldStats(allRows, matcher);
    const fieldCount = fieldStats.reduce((sum, stat) => sum + stat.count, 0);

    this.setState({ fieldCount, fieldLabel, fieldStats, fieldValue, showFieldStats: true });
  };

  onMouseOverMessage = () => {
    // Don't parse right away, user might move along
    this.mouseMessageTimer = setTimeout(this.parseMessage, 500);
  };

  onMouseOutMessage = () => {
    clearTimeout(this.mouseMessageTimer);
    this.setState({ parsed: false });
  };

  parseMessage = () => {
    if (!this.state.parsed) {
      const { row } = this.props;
      const parser = getParser(row.entry);
      if (parser) {
        // Use parser to highlight detected fields
        const parsedFieldHighlights = parser.getFields(this.props.row.entry);
        this.setState({ parsedFieldHighlights, parsed: true, parser });
      }
    }
  };

  render() {
    const {
      getRows,
      highlighterExpressions,
      onClickLabel,
      row,
      showDuplicates,
      showLabels,
      showLocalTime,
      showUtc,
    } = this.props;
    const {
      fieldCount,
      fieldLabel,
      fieldStats,
      fieldValue,
      parsed,
      parsedFieldHighlights,
      showFieldStats,
    } = this.state;
    const { entry, hasAnsi, raw } = row;
    const previewHighlights = highlighterExpressions && !_.isEqual(highlighterExpressions, row.searchWords);
    const highlights = previewHighlights ? highlighterExpressions : row.searchWords;
    const needsHighlighter = highlights && highlights.length > 0 && highlights[0].length > 0;
    const highlightClassName = classnames('logs-row__match-highlight', {
      'logs-row__match-highlight--preview': previewHighlights,
    });

    return (
      <div className="logs-row">
        {showDuplicates && (
          <div className="logs-row__duplicates">{row.duplicates > 0 ? `${row.duplicates + 1}x` : null}</div>
        )}
        <div className={row.logLevel ? `logs-row__level logs-row__level--${row.logLevel}` : ''} />
        {showUtc && (
          <div className="logs-row__time" title={`Local: ${row.timeLocal} (${row.timeFromNow})`}>
            {row.timestamp}
          </div>
        )}
        {showLocalTime && (
          <div className="logs-row__localtime" title={`${row.timestamp} (${row.timeFromNow})`}>
            {row.timeLocal}
          </div>
        )}
        {showLabels && (
          <div className="logs-row__labels">
            <LogLabels getRows={getRows} labels={row.uniqueLabels} onClickLabel={onClickLabel} />
          </div>
        )}
        <div className="logs-row__message" onMouseEnter={this.onMouseOverMessage} onMouseLeave={this.onMouseOutMessage}>
          {parsed && (
            <Highlighter
              autoEscape
              highlightTag={FieldHighlight(this.onClickHighlight)}
              textToHighlight={entry}
              searchWords={parsedFieldHighlights}
              highlightClassName="logs-row__field-highlight"
            />
          )}
          {!parsed && needsHighlighter && (
            <Highlighter
              textToHighlight={entry}
              searchWords={highlights}
              findChunks={findHighlightChunksInText}
              highlightClassName={highlightClassName}
            />
          )}
          {hasAnsi && !parsed && !needsHighlighter && <LogMessageAnsi value={raw} />}
          {!hasAnsi && !parsed && !needsHighlighter && entry}
          {showFieldStats && (
            <div className="logs-row__stats">
              <LogLabelStats
                stats={fieldStats}
                label={fieldLabel}
                value={fieldValue}
                onClickClose={this.onClickClose}
                rowCount={fieldCount}
              />
            </div>
          )}
        </div>
      </div>
    );
  }
}
