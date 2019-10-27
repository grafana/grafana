import React, { PureComponent } from 'react';
import _ from 'lodash';
// @ts-ignore
import Highlighter from 'react-highlight-words';
import { LogRowModel, findHighlightChunksInText } from '@grafana/data';
import tinycolor from 'tinycolor2';
import { css, cx } from 'emotion';
import { GrafanaTheme, selectThemeVariant } from '../../index';
import { LogRowContextQueryErrors, HasMoreContextRows, LogRowContextRows } from './LogRowContextProvider';
import { LogRowContext } from './LogRowContext';
import { LogMessageAnsi } from './LogMessageAnsi';
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

interface State {}

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
    const {} = this.state;
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
      <div className={style.logsRowMessage}>
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
            <Highlighter
              style={{ whiteSpace: 'pre-wrap' }}
              textToHighlight={entry}
              searchWords={highlights}
              findChunks={findHighlightChunksInText}
              highlightClassName={highlightClassName}
            />
            {hasAnsi && !needsHighlighter && <LogMessageAnsi value={raw} />}
            {!hasAnsi && !needsHighlighter && entry}
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
