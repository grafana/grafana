import { cx } from '@emotion/css';
import memoizeOne from 'memoize-one';
import React, { PureComponent } from 'react';
import Highlighter from 'react-highlight-words';

import {
  LogRowModel,
  findHighlightChunksInText,
  LogsSortOrder,
  CoreApp,
  DataSourceWithLogsContextSupport,
} from '@grafana/data';
import { IconButton, Tooltip } from '@grafana/ui';

import { LogMessageAnsi } from './LogMessageAnsi';
import { LogRowContext } from './LogRowContext';
import { LogRowContextQueryErrors, HasMoreContextRows, LogRowContextRows } from './LogRowContextProvider';
import { LogRowStyles } from './getLogRowStyles';

export const MAX_CHARACTERS = 100000;

interface Props {
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
  getLogRowContextUi?: DataSourceWithLogsContextSupport['getLogRowContextUi'];
  getRows: () => LogRowModel[];
  onToggleContext: (method: string) => void;
  updateLimit?: () => void;
  runContextQuery?: () => void;
  logsSortOrder?: LogsSortOrder | null;
  styles: LogRowStyles;
}

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

export class LogRowMessage extends PureComponent<Props> {
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
      errors,
      hasMoreContextRows,
      updateLimit,
      runContextQuery,
      context,
      contextIsOpen,
      showRowMenu,
      wrapLogMessage,
      prettifyLogMessage,
      onToggleContext,
      app,
      logsSortOrder,
      showContextToggle,
      getLogRowContextUi,
      styles,
    } = this.props;
    const { hasAnsi, raw } = row;
    const restructuredEntry = restructureLog(raw, prettifyLogMessage);
    const shouldShowContextToggle = showContextToggle ? showContextToggle(row) : false;
    const inExplore = app === CoreApp.Explore;

    return (
      <>
        {
          // When context is open, the position has to be NOT relative. // Setting the postion as inline-style to
          // overwrite the more sepecific style definition from `styles.logsRowMessage`.
        }
        <td
          ref={this.logRowRef}
          style={contextIsOpen ? { position: 'unset' } : undefined}
          className={styles.logsRowMessage}
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
                getLogRowContextUi={getLogRowContextUi}
                runContextQuery={runContextQuery}
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
            <button className={cx(styles.logLine, styles.positionRelative, { [styles.rowWithContext]: contextIsOpen })}>
              {renderLogMessage(hasAnsi, restructuredEntry, row.searchWords, styles.logsRowMatchHighLight)}
            </button>
          </div>
        </td>
        {showRowMenu && (
          <td
            className={cx('log-row-menu-cell', styles.logRowMenuCell, {
              [styles.logRowMenuCellDefaultPosition]: !inExplore,
              [styles.logRowMenuCellExplore]: inExplore && !shouldShowContextToggle && !wrapLogMessage,
              [styles.logRowMenuCellExploreWithContextButton]: inExplore && shouldShowContextToggle && !wrapLogMessage,
              [styles.logRowMenuCellExploreWrapped]: inExplore && !shouldShowContextToggle && wrapLogMessage,
              [styles.logRowMenuCellExploreWithContextButtonWrapped]:
                inExplore && shouldShowContextToggle && wrapLogMessage,
            })}
          >
            <span
              className={cx('log-row-menu', styles.rowMenu, {
                [styles.rowMenuWithContextButton]: shouldShowContextToggle,
              })}
              onClick={(e) => e.stopPropagation()}
            >
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
