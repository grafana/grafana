import React, { PureComponent } from 'react';
import _ from 'lodash';
// @ts-ignore
import Highlighter from 'react-highlight-words';
import classnames from 'classnames';

import { calculateFieldStats, getParser } from 'app/core/logs_model';
import { LogLabels } from './LogLabels';
import { findHighlightChunksInText } from 'app/core/utils/text';
import { LogLabelStats } from './LogLabelStats';
import { LogMessageAnsi } from './LogMessageAnsi';
import { css, cx } from 'emotion';
import {
  LogRowContextProvider,
  LogRowContextRows,
  HasMoreContextRows,
  LogRowContextQueryErrors,
} from './LogRowContextProvider';
import {
  ThemeContext,
  selectThemeVariant,
  GrafanaTheme,
  DataQueryResponse,
  LogRowModel,
  LogLabelStatsModel,
  LogsParser,
  TimeZone,
} from '@grafana/ui';
import { LogRowContext } from './LogRowContext';
import tinycolor from 'tinycolor2';

interface Props {
  highlighterExpressions?: string[];
  row: LogRowModel;
  showDuplicates: boolean;
  showLabels: boolean;
  showTime: boolean;
  timeZone: TimeZone;
  getRows: () => LogRowModel[];
  onClickLabel?: (label: string, value: string) => void;
  onContextClick?: () => void;
  getRowContext?: (row: LogRowModel, options?: any) => Promise<DataQueryResponse>;
  className?: string;
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
  showContext: boolean;
}

/**
 * Renders a highlighted field.
 * When hovering, a stats icon is shown.
 */
const FieldHighlight = (onClick: any) => (props: any) => {
  return (
    <span className={props.className} style={props.style}>
      {props.children}
      <span className="logs-row__field-highlight--icon fa fa-signal" onClick={() => onClick(props.children)} />
    </span>
  );
};

const logRowStyles = css`
  position: relative;
  /* z-index: 0; */
  /* outline: none; */
`;

const getLogRowWithContextStyles = (theme: GrafanaTheme, state: State) => {
  const outlineColor = selectThemeVariant(
    {
      light: theme.colors.white,
      dark: theme.colors.black,
    },
    theme.type
  );

  return {
    row: css`
      z-index: 1;
      outline: 9999px solid
        ${tinycolor(outlineColor as tinycolor.ColorInput)
          .setAlpha(0.7)
          .toRgbString()};
    `,
  };
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

  state: any = {
    fieldCount: 0,
    fieldLabel: null,
    fieldStats: null,
    fieldValue: null,
    parsed: false,
    parser: undefined,
    parsedFieldHighlights: [],
    showFieldStats: false,
    showContext: false,
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
    if (this.state.showContext || this.isTextSelected()) {
      // When showing context we don't want to the LogRow rerender as it will mess up state of context block
      // making the "after" context to be scrolled to the top, what is desired only on open
      // The log row message needs to be refactored to separate component that encapsulates parsing and parsed message state
      return;
    }
    // Don't parse right away, user might move along
    this.mouseMessageTimer = setTimeout(this.parseMessage, 500);
  };

  onMouseOutMessage = () => {
    if (this.state.showContext) {
      // See comment in onMouseOverMessage method
      return;
    }
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

  isTextSelected() {
    if (!window.getSelection) {
      return false;
    }

    const selection = window.getSelection();

    if (!selection) {
      return false;
    }

    return selection.anchorNode !== null && selection.isCollapsed === false;
  }

  toggleContext = () => {
    this.setState(state => {
      return {
        showContext: !state.showContext,
      };
    });
  };

  onContextToggle = (e: React.SyntheticEvent<HTMLElement>) => {
    e.stopPropagation();
    this.toggleContext();
  };

  renderLogRow(
    context?: LogRowContextRows,
    errors?: LogRowContextQueryErrors,
    hasMoreContextRows?: HasMoreContextRows,
    updateLimit?: () => void
  ) {
    const {
      getRows,
      highlighterExpressions,
      onClickLabel,
      row,
      showDuplicates,
      showLabels,
      timeZone,
      showTime,
    } = this.props;
    const {
      fieldCount,
      fieldLabel,
      fieldStats,
      fieldValue,
      parsed,
      parsedFieldHighlights,
      showFieldStats,
      showContext,
    } = this.state;
    const { entry, hasAnsi, raw } = row;
    const previewHighlights = highlighterExpressions && !_.isEqual(highlighterExpressions, row.searchWords);
    const highlights = previewHighlights ? highlighterExpressions : row.searchWords;
    const needsHighlighter = highlights && highlights.length > 0 && highlights[0] && highlights[0].length > 0;
    const highlightClassName = classnames('logs-row__match-highlight', {
      'logs-row__match-highlight--preview': previewHighlights,
    });
    const showUtc = timeZone === 'utc';

    return (
      <ThemeContext.Consumer>
        {theme => {
          const styles = this.state.showContext
            ? cx(logRowStyles, getLogRowWithContextStyles(theme, this.state).row)
            : logRowStyles;
          return (
            <div className={`logs-row ${this.props.className}`}>
              {showDuplicates && (
                <div className="logs-row__duplicates">{row.duplicates > 0 ? `${row.duplicates + 1}x` : null}</div>
              )}
              <div className={row.logLevel ? `logs-row__level logs-row__level--${row.logLevel}` : ''} />
              {showTime && showUtc && (
                <div className="logs-row__localtime" title={`Local: ${row.timeLocal} (${row.timeFromNow})`}>
                  {row.timeUtc}
                </div>
              )}
              {showTime && !showUtc && (
                <div className="logs-row__localtime" title={`${row.timeUtc} (${row.timeFromNow})`}>
                  {row.timeLocal}
                </div>
              )}
              {showLabels && (
                <div className="logs-row__labels">
                  <LogLabels getRows={getRows} labels={row.uniqueLabels} onClickLabel={onClickLabel} />
                </div>
              )}
              <div
                className="logs-row__message"
                onMouseEnter={this.onMouseOverMessage}
                onMouseLeave={this.onMouseOutMessage}
              >
                <div
                  className={css`
                    position: relative;
                  `}
                >
                  {showContext && context && (
                    <LogRowContext
                      row={row}
                      context={context}
                      errors={errors}
                      hasMoreContextRows={hasMoreContextRows}
                      onOutsideClick={this.toggleContext}
                      onLoadMoreContext={() => {
                        if (updateLimit) {
                          updateLimit();
                        }
                      }}
                    />
                  )}
                  <span className={styles}>
                    {parsed && (
                      <Highlighter
                        style={{ whiteSpace: 'pre-wrap' }}
                        autoEscape
                        highlightTag={FieldHighlight(this.onClickHighlight)}
                        textToHighlight={entry}
                        searchWords={parsedFieldHighlights}
                        highlightClassName="logs-row__field-highlight"
                      />
                    )}
                    {!parsed && needsHighlighter && (
                      <Highlighter
                        style={{ whiteSpace: 'pre-wrap' }}
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
                  </span>
                  {row.searchWords && row.searchWords.length > 0 && (
                    <span
                      onClick={this.onContextToggle}
                      className={css`
                        visibility: hidden;
                        white-space: nowrap;
                        position: relative;
                        z-index: ${showContext ? 1 : 0};
                        cursor: pointer;
                        .logs-row:hover & {
                          visibility: visible;
                          margin-left: 10px;
                          text-decoration: underline;
                        }
                      `}
                    >
                      {showContext ? 'Hide' : 'Show'} context
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        }}
      </ThemeContext.Consumer>
    );
  }

  render() {
    const { showContext } = this.state;

    if (showContext) {
      return (
        <>
          <LogRowContextProvider row={this.props.row} getRowContext={this.props.getRowContext}>
            {({ result, errors, hasMoreContextRows, updateLimit }) => {
              return <>{this.renderLogRow(result, errors, hasMoreContextRows, updateLimit)}</>;
            }}
          </LogRowContextProvider>
        </>
      );
    }

    return this.renderLogRow();
  }
}
