import React, { PureComponent } from 'react';
import _ from 'lodash';
import tinycolor from 'tinycolor2';
import { css, cx } from 'emotion';
import { LogRowModel, findHighlightChunksInText, GrafanaTheme } from '@grafana/data';

// @ts-ignore
import Highlighter from 'react-highlight-words';
import { LogRowContextQueryErrors, HasMoreContextRows, LogRowContextRows } from './LogRowContextProvider';
import { selectThemeVariant } from '../../index';
import { Themeable } from '../../types/theme';
import { withTheme } from '../../themes/index';
import { getLogRowStyles } from './getLogRowStyles';
import { stylesFactory } from '../../themes/stylesFactory';

//Components
import { LogRowContext } from './LogRowContext';
import { LogMessageAnsi } from './LogMessageAnsi';

interface Props extends Themeable {
  row: LogRowModel;
  hasMoreContextRows?: HasMoreContextRows;
  showContext: boolean;
  wrapLogMessage: boolean;
  errors?: LogRowContextQueryErrors;
  context?: LogRowContextRows;
  highlighterExpressions?: string[];
  getRows: () => LogRowModel[];
  onToggleContext: () => void;
  updateLimit?: () => void;
}

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
    horizontalScroll: css`
      label: verticalScroll;
      white-space: nowrap;
    `,
  };
});

class UnThemedLogRowMessage extends PureComponent<Props> {
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
      wrapLogMessage,
      onToggleContext,
    } = this.props;

    const style = getLogRowStyles(theme, row.logLevel);
    const { entry, hasAnsi, raw } = row;

    const previewHighlights = highlighterExpressions && !_.isEqual(highlighterExpressions, row.searchWords);
    const highlights = previewHighlights ? highlighterExpressions : row.searchWords;
    const needsHighlighter = highlights && highlights.length > 0 && highlights[0] && highlights[0].length > 0;
    const highlightClassName = previewHighlights
      ? cx([style.logsRowMatchHighLight, style.logsRowMatchHighLightPreview])
      : cx([style.logsRowMatchHighLight]);
    const styles = getStyles(theme);
    const whiteSpacePreWrap = {
      label: 'white-space-pre-wrap',
      whiteSpace: 'pre-wrap',
    };

    return (
      <td className={style.logsRowMessage}>
        <div className={cx(styles.positionRelative, { [styles.horizontalScroll]: !wrapLogMessage })}>
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
            {needsHighlighter ? (
              <Highlighter
                style={whiteSpacePreWrap}
                textToHighlight={entry}
                searchWords={highlights}
                findChunks={findHighlightChunksInText}
                highlightClassName={highlightClassName}
              />
            ) : hasAnsi ? (
              <LogMessageAnsi value={raw} />
            ) : (
              entry
            )}
          </span>
          {row.searchWords && row.searchWords.length > 0 && (
            <span onClick={this.onContextToggle} className={cx(style.context)}>
              {showContext ? 'Hide' : 'Show'} context
            </span>
          )}
        </div>
      </td>
    );
  }
}

export const LogRowMessage = withTheme(UnThemedLogRowMessage);
LogRowMessage.displayName = 'LogRowMessage';
