import { css, cx } from '@emotion/css';
import memoizeOne from 'memoize-one';
import React, { PureComponent } from 'react';
import Highlighter from 'react-highlight-words';
import tinycolor from 'tinycolor2';

import { LogRowModel, findHighlightChunksInText, GrafanaTheme2, LogsSortOrder, CoreApp } from '@grafana/data';
import { withTheme2, Themeable2, IconButton, Tooltip } from '@grafana/ui';

import { LogMessageAnsi } from './LogMessageAnsi';
import { LogRowContext } from './LogRowContext';
import { LogRowContextQueryErrors, HasMoreContextRows, LogRowContextRows } from './LogRowContextProvider';
import { getLogRowStyles } from './getLogRowStyles';

export const MAX_CHARACTERS = 100000;

interface Props extends Themeable2 {
  row: LogRowModel;
  hasMoreContextRows?: HasMoreContextRows;
  contextIsOpen: boolean;
  wrapLogMessage: boolean;
  prettifyLogMessage: boolean;
  errors?: LogRowContextQueryErrors;
  context?: LogRowContextRows;
  showRowMenu?: boolean;
  app?: CoreApp;
  scrollElement?: HTMLDivElement;
  showContextToggle?: (row?: LogRowModel) => boolean;
  getRows: () => LogRowModel[];
  onToggleContext: (method: string) => void;
  updateLimit?: () => void;
  logsSortOrder?: LogsSortOrder | null;
}

const getStyles = (theme: GrafanaTheme2, showContextButton: boolean, isInDashboard: boolean | undefined) => {
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
      display: inherit;
    `,
    horizontalScroll: css`
      label: horizontalScroll;
      white-space: pre;
    `,
    contextNewline: css`
      display: block;
      margin-left: 0px;
    `,
    rowMenu: css`
      display: flex;
      flex-wrap: nowrap;
      flex-direction: row;
      align-content: flex-end;
      justify-content: space-evenly;
      align-items: center;
      position: absolute;
      top: 0;
      bottom: auto;
      height: ${theme.spacing(4.5)};
      background: ${theme.colors.background.primary};
      box-shadow: ${theme.shadows.z3};
      padding: ${theme.spacing(0, 0, 0, 0.5)};
      z-index: 100;
      visibility: hidden;
      width: ${showContextButton ? theme.spacing(10) : theme.spacing(5)};
    `,
    logRowMenuCell: css`
      position: absolute;
      right: ${isInDashboard ? '40px' : `calc(75px + ${theme.spacing()} + ${showContextButton ? '80px' : '40px'})`};
      margin-top: -${theme.spacing(0.125)};
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
  logRowRef: React.RefObject<HTMLTableCellElement> = React.createRef();

  onContextToggle = (e: React.SyntheticEvent<HTMLElement>) => {
    e.stopPropagation();
    this.props.onToggleContext('open');
  };

  onShowContextClick = (e: React.SyntheticEvent<HTMLElement, Event>) => {
    const { scrollElement } = this.props;
    this.onContextToggle(e);
    if (scrollElement && this.logRowRef.current) {
      scrollElement.scroll({
        behavior: 'smooth',
        top: scrollElement.scrollTop + this.logRowRef.current.getBoundingClientRect().top - window.innerHeight / 2,
      });
    }
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
      showRowMenu,
      wrapLogMessage,
      prettifyLogMessage,
      onToggleContext,
      app,
      logsSortOrder,
      showContextToggle,
    } = this.props;

    const style = getLogRowStyles(theme, row.logLevel);
    const { hasAnsi, raw } = row;
    const restructuredEntry = restructureLog(raw, prettifyLogMessage);
    const shouldShowContextToggle = showContextToggle ? showContextToggle(row) : false;
    const styles = getStyles(theme, shouldShowContextToggle, app === CoreApp.Dashboard);

    return (
      <>
        {
          // When context is open, the position has to be NOT relative. // Setting the postion as inline-style to
          // overwrite the more sepecific style definition from `style.logsRowMessage`.
        }
        <td
          ref={this.logRowRef}
          style={contextIsOpen ? { position: 'unset' } : undefined}
          className={style.logsRowMessage}
        >
          <div
            className={cx(
              { [styles.positionRelative]: wrapLogMessage },
              { [styles.horizontalScroll]: !wrapLogMessage }
            )}
          >
            {contextIsOpen && context && (
              <LogRowContext
                row={row}
                context={context}
                errors={errors}
                wrapLogMessage={wrapLogMessage}
                hasMoreContextRows={hasMoreContextRows}
                onOutsideClick={onToggleContext}
                logsSortOrder={logsSortOrder}
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
          </div>
        </td>
        {showRowMenu && (
          <td className={cx('log-row-menu-cell', styles.logRowMenuCell)}>
            <span className={cx('log-row-menu', styles.rowMenu)} onClick={(e) => e.stopPropagation()}>
              {shouldShowContextToggle && (
                <Tooltip placement="top" content={'Show context'}>
                  <IconButton size="md" name="gf-show-context" onClick={this.onShowContextClick} />
                </Tooltip>
              )}
              <Tooltip placement="top" content={'Copy'}>
                <IconButton size="md" name="copy" onClick={() => navigator.clipboard.writeText(restructuredEntry)} />
              </Tooltip>
            </span>
          </td>
        )}
      </>
    );
  }
}

export const LogRowMessage = withTheme2(UnThemedLogRowMessage);
LogRowMessage.displayName = 'LogRowMessage';
