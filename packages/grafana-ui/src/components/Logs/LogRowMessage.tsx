import React, { PureComponent, FunctionComponent, useContext } from 'react';
import _ from 'lodash';
// @ts-ignore
import Highlighter from 'react-highlight-words';
import {
  LogRowModel,
  LogLabelStatsModel,
  LogsParser,
  calculateFieldStats,
  getParser,
  findHighlightChunksInText,
} from '@grafana/data';
import tinycolor from 'tinycolor2';
import { css, cx } from 'emotion';
import { GrafanaTheme, selectThemeVariant, ThemeContext } from '../../index';
import { LogRowContextQueryErrors, HasMoreContextRows, LogRowContextRows } from './LogRowContextProvider';
import { LogRowContext } from './LogRowContext';
import { LogMessageAnsi } from './LogMessageAnsi';
import { LogLabelStats } from './LogLabelStats';
import { Themeable } from '../../types/theme';
import { withTheme } from '../../themes/index';
import { getLogRowStyles } from './getLogRowStyles';
import { stylesFactory } from '../../themes/stylesFactory';

interface Props extends Themeable {
  highlighterExpressions?: string[];
  row: LogRowModel;
  getRows: () => LogRowModel[];
  errors?: LogRowContextQueryErrors;
  hasMoreContextRows?: HasMoreContextRows;
  updateLimit?: () => void;
  context?: LogRowContextRows;
  showContext: boolean;
  onToggleContext: () => void;
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

/**
 * Renders a highlighted field.
 * When hovering, a stats icon is shown.
 */
const FieldHighlight = (onClick: any): FunctionComponent<any> => (props: any) => {
  const theme = useContext(ThemeContext);
  const style = getLogRowStyles(theme);
  return (
    <span className={props.className} style={props.style}>
      {props.children}
      <span
        className={cx([style, 'logs-row__field-highlight--icon', 'fa fa-signal'])}
        onClick={() => onClick(props.children)}
      />
    </span>
  );
};

const getStyles = stylesFactory((theme: GrafanaTheme) => {
  const outlineColor = selectThemeVariant(
    {
      light: theme.colors.white,
      dark: theme.colors.black,
    },
    theme.type
  );

  return {
    positionRelative: css`
      label: positionRelative;
      position: relative;
    `,
    rowWithContext: css`
      label: rowWithContext;
      z-index: 1;
      outline: 9999px solid
        ${tinycolor(outlineColor as tinycolor.ColorInput)
          .setAlpha(0.7)
          .toRgbString()};
    `,
  };
});

class UnThemedLogRowMessage extends PureComponent<Props, State> {
  mouseMessageTimer: number | null = null;

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

  componentWillUnmount() {
    this.clearMouseMessageTimer();
  }

  onClickClose = () => {
    this.setState({ showFieldStats: false });
  };

  onClickHighlight = (fieldText: string) => {
    const { getRows } = this.props;
    const { parser } = this.state;
    const allRows = getRows();

    // Build value-agnostic row matcher based on the field label
    const fieldLabel = parser!.getLabelFromField(fieldText);
    const fieldValue = parser!.getValueFromField(fieldText);
    const matcher = parser!.buildMatcher(fieldLabel);
    const fieldStats = calculateFieldStats(allRows, matcher);
    const fieldCount = fieldStats.reduce((sum, stat) => sum + stat.count, 0);

    this.setState({ fieldCount, fieldLabel, fieldStats, fieldValue, showFieldStats: true });
  };

  onMouseOverMessage = () => {
    if (this.props.showContext || this.isTextSelected()) {
      // When showing context we don't want to the LogRow rerender as it will mess up state of context block
      // making the "after" context to be scrolled to the top, what is desired only on open
      // The log row message needs to be refactored to separate component that encapsulates parsing and parsed message state
      return;
    }
    // Don't parse right away, user might move along
    this.mouseMessageTimer = window.setTimeout(this.parseMessage, 500);
  };

  onMouseOutMessage = () => {
    if (this.props.showContext) {
      // See comment in onMouseOverMessage method
      return;
    }
    this.clearMouseMessageTimer();
    this.setState({ parsed: false });
  };

  clearMouseMessageTimer = () => {
    if (this.mouseMessageTimer) {
      clearTimeout(this.mouseMessageTimer);
    }
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

  onContextToggle = (e: React.SyntheticEvent<HTMLElement>) => {
    e.stopPropagation();
    this.props.onToggleContext();
  };

  render() {
    const {
      highlighterExpressions,
      row,
      theme,
      errors,
      hasMoreContextRows,
      updateLimit,
      context,
      showContext,
      onToggleContext,
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
    const style = getLogRowStyles(theme, row.logLevel);
    const { entry, hasAnsi, raw } = row;
    const previewHighlights = highlighterExpressions && !_.isEqual(highlighterExpressions, row.searchWords);
    const highlights = previewHighlights ? highlighterExpressions : row.searchWords;
    const needsHighlighter = highlights && highlights.length > 0 && highlights[0] && highlights[0].length > 0;
    const highlightClassName = previewHighlights
      ? cx([style.logsRowMatchHighLight, style.logsRowMatchHighLightPreview])
      : cx([style.logsRowMatchHighLight]);
    const styles = getStyles(theme);

    return (
      <div
        className={cx([style.logsRowMessage])}
        onMouseEnter={this.onMouseOverMessage}
        onMouseLeave={this.onMouseOutMessage}
      >
        <div className={styles.positionRelative}>
          {showContext && context && (
            <LogRowContext
              row={row}
              context={context}
              errors={errors}
              hasMoreContextRows={hasMoreContextRows}
              onOutsideClick={onToggleContext}
              onLoadMoreContext={() => {
                if (updateLimit) {
                  updateLimit();
                }
              }}
            />
          )}
          <span className={cx(styles.positionRelative, { [styles.rowWithContext]: showContext })}>
            {parsed && (
              <Highlighter
                style={{ whiteSpace: 'pre-wrap' }}
                autoEscape
                highlightTag={FieldHighlight(this.onClickHighlight)}
                textToHighlight={entry}
                searchWords={parsedFieldHighlights}
                highlightClassName={cx([style.logsRowFieldHighLight])}
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
              <div className={cx([style.logsRowStats])}>
                <LogLabelStats
                  stats={fieldStats!}
                  label={fieldLabel!}
                  value={fieldValue!}
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
                .${style.logsRow}:hover & {
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
    );
  }
}

export const LogRowMessage = withTheme(UnThemedLogRowMessage);
LogRowMessage.displayName = 'LogRowMessage';
