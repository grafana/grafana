import { cx } from '@emotion/css';
import React, { useMemo } from 'react';
import Highlighter from 'react-highlight-words';

import { CoreApp, findHighlightChunksInText, LogRowModel } from '@grafana/data';

import { LogMessageAnsi } from './LogMessageAnsi';
import { LogRowMenuCell } from './LogRowMenuCell';
import { LogRowStyles } from './getLogRowStyles';

export const MAX_CHARACTERS = 100000;

interface Props {
  row: LogRowModel;
  wrapLogMessage: boolean;
  prettifyLogMessage: boolean;
  app?: CoreApp;
  showContextToggle?: (row?: LogRowModel) => boolean;
  onOpenContext: (row: LogRowModel) => void;
  onPermalinkClick?: (row: LogRowModel) => Promise<void>;
  onPinLine?: (row: LogRowModel) => void;
  onUnpinLine?: (row: LogRowModel) => void;
  pinned?: boolean;
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

const restructureLog = (line: string, prettifyLogMessage: boolean): string => {
  if (prettifyLogMessage) {
    try {
      return JSON.stringify(JSON.parse(line), undefined, 2);
    } catch (error) {
      return line;
    }
  }
  return line;
};

export const LogRowMessage = React.memo((props: Props) => {
  const {
    row,
    wrapLogMessage,
    prettifyLogMessage,
    showContextToggle,
    styles,
    onOpenContext,
    onPermalinkClick,
    onUnpinLine,
    onPinLine,
    pinned,
  } = props;
  const { hasAnsi, raw } = row;
  const restructuredEntry = useMemo(() => restructureLog(raw, prettifyLogMessage), [raw, prettifyLogMessage]);
  return (
    <>
      {
        // When context is open, the position has to be NOT relative. // Setting the postion as inline-style to
        // overwrite the more sepecific style definition from `styles.logsRowMessage`.
      }
      <td className={styles.logsRowMessage}>
        <div
          className={cx({ [styles.positionRelative]: wrapLogMessage }, { [styles.horizontalScroll]: !wrapLogMessage })}
        >
          <button className={cx(styles.logLine, styles.positionRelative)}>
            {renderLogMessage(hasAnsi, restructuredEntry, row.searchWords, styles.logsRowMatchHighLight)}
          </button>
        </div>
      </td>
      <td className={cx('log-row-menu-cell', styles.logRowMenuCell)}>
        <LogRowMenuCell
          logText={restructuredEntry}
          row={row}
          showContextToggle={showContextToggle}
          onOpenContext={onOpenContext}
          onPermalinkClick={onPermalinkClick}
          onPinLine={onPinLine}
          onUnpinLine={onUnpinLine}
          pinned={pinned}
          styles={styles}
        />
      </td>
    </>
  );
});

LogRowMessage.displayName = 'LogRowMessage';
