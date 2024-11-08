import { memo, ReactNode, useMemo } from 'react';
import Highlighter from 'react-highlight-words';

import { CoreApp, findHighlightChunksInText, LogRowContextOptions, LogRowModel } from '@grafana/data';
import { DataQuery } from '@grafana/schema';
import { PopoverContent } from '@grafana/ui';

import { LogMessageAnsi } from './LogMessageAnsi';
import { LogRowMenuCell } from './LogRowMenuCell';
import { LogRowStyles } from './getLogRowStyles';

export const MAX_CHARACTERS = 100000;

interface Props {
  row: LogRowModel;
  wrapLogMessage: boolean;
  prettifyLogMessage: boolean;
  app?: CoreApp;
  showContextToggle?: (row: LogRowModel) => boolean;
  onOpenContext: (row: LogRowModel) => void;
  getRowContextQuery?: (
    row: LogRowModel,
    options?: LogRowContextOptions,
    cacheFilters?: boolean
  ) => Promise<DataQuery | null>;
  onPermalinkClick?: (row: LogRowModel) => Promise<void>;
  onPinLine?: (row: LogRowModel) => void;
  onUnpinLine?: (row: LogRowModel) => void;
  pinLineButtonTooltipTitle?: PopoverContent;
  pinned?: boolean;
  styles: LogRowStyles;
  mouseIsOver: boolean;
  onBlur: () => void;
  expanded?: boolean;
  logRowMenuIconsBefore?: ReactNode[];
  logRowMenuIconsAfter?: ReactNode[];
}

interface LogMessageProps {
  hasAnsi: boolean;
  entry: string;
  highlights: string[] | undefined;
  styles: LogRowStyles;
}

const LogMessage = ({ hasAnsi, entry, highlights, styles }: LogMessageProps) => {
  const needsHighlighter =
    highlights && highlights.length > 0 && highlights[0] && highlights[0].length > 0 && entry.length < MAX_CHARACTERS;
  const searchWords = highlights ?? [];
  if (hasAnsi) {
    const highlight = needsHighlighter ? { searchWords, highlightClassName: styles.logsRowMatchHighLight } : undefined;
    return <LogMessageAnsi value={entry} highlight={highlight} />;
  } else if (needsHighlighter) {
    return (
      <Highlighter
        textToHighlight={entry}
        searchWords={searchWords}
        findChunks={findHighlightChunksInText}
        highlightClassName={styles.logsRowMatchHighLight}
      />
    );
  }
  return <>{entry}</>;
};

const restructureLog = (
  line: string,
  prettifyLogMessage: boolean,
  wrapLogMessage: boolean,
  expanded: boolean
): string => {
  if (prettifyLogMessage) {
    try {
      return JSON.stringify(JSON.parse(line), undefined, 2);
    } catch (error) {}
  }
  // With wrapping disabled, we want to turn it into a single-line log entry unless the line is expanded
  if (!wrapLogMessage && !expanded) {
    line = line.replace(/(\r\n|\n|\r)/g, '');
  }
  return line;
};

export const LogRowMessage = memo((props: Props) => {
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
    pinLineButtonTooltipTitle,
    pinned,
    mouseIsOver,
    onBlur,
    getRowContextQuery,
    expanded,
    logRowMenuIconsBefore,
    logRowMenuIconsAfter,
  } = props;
  const { hasAnsi, raw } = row;
  const restructuredEntry = useMemo(
    () => restructureLog(raw, prettifyLogMessage, wrapLogMessage, Boolean(expanded)),
    [raw, prettifyLogMessage, wrapLogMessage, expanded]
  );
  const shouldShowMenu = useMemo(() => mouseIsOver || pinned, [mouseIsOver, pinned]);
  return (
    <>
      {
        // When context is open, the position has to be NOT relative. // Setting the postion as inline-style to
        // overwrite the more sepecific style definition from `styles.logsRowMessage`.
      }
      <td className={styles.logsRowMessage}>
        <div className={wrapLogMessage ? styles.positionRelative : styles.horizontalScroll}>
          <button className={`${styles.logLine} ${styles.positionRelative}`}>
            <LogMessage hasAnsi={hasAnsi} entry={restructuredEntry} highlights={row.searchWords} styles={styles} />
          </button>
        </div>
      </td>
      <td className={`log-row-menu-cell ${styles.logRowMenuCell}`}>
        {shouldShowMenu && (
          <LogRowMenuCell
            logText={restructuredEntry}
            row={row}
            showContextToggle={showContextToggle}
            getRowContextQuery={getRowContextQuery}
            onOpenContext={onOpenContext}
            onPermalinkClick={onPermalinkClick}
            onPinLine={onPinLine}
            onUnpinLine={onUnpinLine}
            pinLineButtonTooltipTitle={pinLineButtonTooltipTitle}
            pinned={pinned}
            styles={styles}
            mouseIsOver={mouseIsOver}
            onBlur={onBlur}
            addonBefore={logRowMenuIconsBefore}
            addonAfter={logRowMenuIconsAfter}
          />
        )}
      </td>
    </>
  );
});

LogRowMessage.displayName = 'LogRowMessage';
