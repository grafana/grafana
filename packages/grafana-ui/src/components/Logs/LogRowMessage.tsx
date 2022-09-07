import { css, cx } from '@emotion/css';
import memoizeOne from 'memoize-one';
import React, { PureComponent } from 'react';
import Highlighter from 'react-highlight-words';
import tinycolor from 'tinycolor2';

import { LogRowModel, findHighlightChunksInText, GrafanaTheme2 } from '@grafana/data';

// @ts-ignore

import { withTheme2 } from '../../themes/index';
import { Themeable2 } from '../../types/theme';

import { LogMessageAnsi } from './LogMessageAnsi';
import { LogRowContext } from './LogRowContext';
import { LogRowContextQueryErrors, HasMoreContextRows, LogRowContextRows } from './LogRowContextProvider';
import { getLogRowStyles } from './getLogRowStyles';

//Components

export const MAX_CHARACTERS = 100000;

interface Props extends Themeable2 {
  row: LogRowModel;
  hasMoreContextRows?: HasMoreContextRows;
  contextIsOpen: boolean;
  wrapLogMessage: boolean;
  prettifyLogMessage: boolean;
  errors?: LogRowContextQueryErrors;
  context?: LogRowContextRows;
  showContextToggle?: (row?: LogRowModel) => boolean;
  getRows: () => LogRowModel[];
  onToggleContext: () => void;
  updateLimit?: () => void;
}

const getStyles = (theme: GrafanaTheme2) => {
  const outlineColor = tinycolor(theme.components.dashboard.background).setAlpha(0.7).toRgbString();

  return {
    positionRelative: css`
      label: positionRelative;
      position: relative;
    `,
    rowWithContext: css`
      label: rowWithContext;
      z-index: 1;
      outline: 9999px solid ${outlineColor};
    `,
    horizontalScroll: css`
      label: verticalScroll;
      white-space: pre;
    `,
    contextNewline: css`
      display: block;
      margin-left: 0px;
    `,
  };
};

function renderLogMessage(
  hasAnsi: boolean,
  entry: string,
  highlights: string[] | undefined,
  highlightClassName: string
) {
  const needsHighlighter =
    highlights && highlights.length > 0 && highlights[0] && highlights[0].length > 0 && entry.length < MAX_CHARACTERS;
  const searchWords = highlights ?? [];
  if (hasAnsi) {
    const highlight = needsHighlighter ? { searchWords, highlightClassName } : undefined;
    return <LogMessageAnsi value={entry} highlight={highlight} />;
  } else if (needsHighlighter) {
    return (
      <Highlighter
        textToHighlight={entry}
        searchWords={searchWords}
        findChunks={findHighlightChunksInText}
        highlightClassName={highlightClassName}
      />
    );
  } else {
    return entry;
  }
}

const restructureLog = memoizeOne((line: string, prettifyLogMessage: boolean): string => {
  if (prettifyLogMessage) {
    try {
      return JSON.stringify(JSON.parse(line), undefined, 2);
    } catch (error) {
      return line;
    }
  }
  return line;
});

class UnThemedLogRowMessage extends PureComponent<Props> {
  onContextToggle = (e: React.SyntheticEvent<HTMLElement>) => {
    e.stopPropagation();
    this.props.onToggleContext();
  };

  render() {
    const {
      row,
      theme,
      errors,
      hasMoreContextRows,
      updateLimit,
      context,
      contextIsOpen,
      showContextToggle,
      wrapLogMessage,
      prettifyLogMessage,
      onToggleContext,
    } = this.props;

    const style = getLogRowStyles(theme, row.logLevel);
    const { hasAnsi, raw } = row;
    const restructuredEntry = restructureLog(raw, prettifyLogMessage);
    const styles = getStyles(theme);

    return (
      // When context is open, the position has to be NOT relative.
      // Setting the postion as inline-style to overwrite the more sepecific style definition from `style.logsRowMessage`.
      <td style={contextIsOpen ? { position: 'unset' } : undefined} className={style.logsRowMessage}>
        <div
          className={cx({ [styles.positionRelative]: wrapLogMessage }, { [styles.horizontalScroll]: !wrapLogMessage })}
        >
          {contextIsOpen && context && (
            <LogRowContext
              row={row}
              context={context}
              errors={errors}
              wrapLogMessage={wrapLogMessage}
              hasMoreContextRows={hasMoreContextRows}
              onOutsideClick={onToggleContext}
              onLoadMoreContext={() => {
                if (updateLimit) {
                  updateLimit();
                }
              }}
            />
          )}
          <span className={cx(styles.positionRelative, { [styles.rowWithContext]: contextIsOpen })}>
            {renderLogMessage(hasAnsi, restructuredEntry, row.searchWords, style.logsRowMatchHighLight)}
          </span>
          {showContextToggle?.(row) && (
            <span
              onClick={this.onContextToggle}
              className={cx('log-row-context', style.context, { [styles.contextNewline]: !wrapLogMessage })}
            >
              {contextIsOpen ? 'Hide' : 'Show'} context
            </span>
          )}
        </div>
      </td>
    );
  }
}

export const LogRowMessage = withTheme2(UnThemedLogRowMessage);
LogRowMessage.displayName = 'LogRowMessage';
