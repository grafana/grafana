import { cx } from '@emotion/css';
import memoizeOne from 'memoize-one';
import React, { PureComponent } from 'react';
import Highlighter from 'react-highlight-words';

import { LogRowModel, findHighlightChunksInText, CoreApp } from '@grafana/data';
import { IconButton, Tooltip } from '@grafana/ui';

import { LogMessageAnsi } from './LogMessageAnsi';
import { LogRowStyles } from './getLogRowStyles';

export const MAX_CHARACTERS = 100000;

interface Props {
  row: LogRowModel;
  wrapLogMessage: boolean;
  prettifyLogMessage: boolean;
  app?: CoreApp;
  showContextToggle?: (row?: LogRowModel) => boolean;
  onOpenContext: (row: LogRowModel) => void;
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
  onShowContextClick = (e: React.SyntheticEvent<HTMLElement, Event>) => {
    const { onOpenContext } = this.props;
    e.stopPropagation();
    onOpenContext(this.props.row);
  };

  render() {
    const { row, wrapLogMessage, prettifyLogMessage, showContextToggle, styles } = this.props;
    const { hasAnsi, raw } = row;
    const restructuredEntry = restructureLog(raw, prettifyLogMessage);
    const shouldShowContextToggle = showContextToggle ? showContextToggle(row) : false;

    return (
      <>
        {
          // When context is open, the position has to be NOT relative. // Setting the postion as inline-style to
          // overwrite the more sepecific style definition from `styles.logsRowMessage`.
        }
        <td className={styles.logsRowMessage}>
          <div
            className={cx(
              { [styles.positionRelative]: wrapLogMessage },
              { [styles.horizontalScroll]: !wrapLogMessage }
            )}
          >
            <button className={cx(styles.logLine, styles.positionRelative)}>
              {renderLogMessage(hasAnsi, restructuredEntry, row.searchWords, styles.logsRowMatchHighLight)}
            </button>
          </div>
        </td>
        <td className={cx('log-row-menu-cell', styles.logRowMenuCell)}>
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
      </>
    );
  }
}
