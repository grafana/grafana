import React, { useCallback, useEffect, useMemo, useRef, useState, MouseEvent, ReactElement } from 'react';
import Highlighter from 'react-highlight-words';

import { CoreApp, findHighlightChunksInText, LogRowModel } from '@grafana/data';
import { Dropdown, Menu } from '@grafana/ui';

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
  onPermalinkClick?: (row: LogRowModel) => Promise<void>;
  onPinLine?: (row: LogRowModel) => void;
  onUnpinLine?: (row: LogRowModel) => void;
  pinned?: boolean;
  styles: LogRowStyles;
  mouseIsOver: boolean;
  onBlur: () => void;
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
    mouseIsOver,
    onBlur,
  } = props;
  const { hasAnsi, raw } = row;
  const restructuredEntry = useMemo(() => restructureLog(raw, prettifyLogMessage), [raw, prettifyLogMessage]);
  const shouldShowMenu = useMemo(() => mouseIsOver || pinned, [mouseIsOver, pinned]);
  
  return (
    <>
      {
        // When context is open, the position has to be NOT relative. // Setting the postion as inline-style to
        // overwrite the more sepecific style definition from `styles.logsRowMessage`.
      }
      <td className={styles.logsRowMessage}>
        <div className={wrapLogMessage ? styles.positionRelative : styles.horizontalScroll}>
            <PopoverMenuHandler styles={styles}>
              <LogMessage hasAnsi={hasAnsi} entry={restructuredEntry} highlights={row.searchWords} styles={styles} />
            </PopoverMenuHandler>
        </div>
      </td>
      <td className={`log-row-menu-cell ${styles.logRowMenuCell}`}>
        {shouldShowMenu && (
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
            mouseIsOver={mouseIsOver}
            onBlur={onBlur}
          />
        )}
      </td>
    </>
  );
});

interface PopoverMenuHandlerProps {
  styles: LogRowStyles;
  children: ReactElement;
}

const PopoverMenuHandler = ({ children, styles }: PopoverMenuHandlerProps) => {
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [xCoordinate, setXcoordinate] = useState(0);

  useEffect(() => {
    const handleDeselect = () => {
      setShowContextMenu(false);
    }
    document.addEventListener("selectionchange", handleDeselect);
    return () => {
      document.removeEventListener("selectionchange", handleDeselect);
    };
  }, []);

  const handlePropagation = useCallback((e: MouseEvent) => {
    if (document.getSelection()?.toString()) {
      e.stopPropagation();
    }
  }, []);
  const handleSelection = useCallback((e: MouseEvent<HTMLButtonElement>) => {
    const selection = document.getSelection()?.toString();
    if (!selection) {
      return;
    }
    const position = e.currentTarget.getBoundingClientRect();
    setShowContextMenu(true);
    setXcoordinate(e.clientX - position.left);
  }, []);

  const menu = useMemo(() => (
    <div style={{ position: "absolute", top: 0, left: xCoordinate, zIndex: 9999 }}>
      <Menu>
        <Menu.Item label="Copy" onClick={() => {}} />
        <Menu.Item label="Filter for" onClick={() => {}} />
        <Menu.Item label="Filter out" onClick={() => {}} />
      </Menu>
    </div>
  ), [xCoordinate]);

  return (
    <div style={{ position: "relative" }}>
      {showContextMenu && menu}
      <button className={`${styles.logLine} ${styles.positionRelative}`} onClick={handlePropagation} onMouseUp={handleSelection}>
        <>{children}</>
      </button>
    </div>
  )
}

LogRowMessage.displayName = 'LogRowMessage';
