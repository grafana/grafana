import React, { useCallback, useEffect, useMemo, useRef, useState, MouseEvent, ReactElement } from 'react';
import Highlighter from 'react-highlight-words';

import { CoreApp, findHighlightChunksInText, LogRowModel } from '@grafana/data';
import { Dropdown, Menu } from '@grafana/ui';

import { LogMessageAnsi } from './LogMessageAnsi';
import { LogRowMenuCell } from './LogRowMenuCell';
import { LogRowStyles } from './getLogRowStyles';
import { parseKeyValue } from 'app/plugins/datasource/loki/queryUtils';

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
  onClickFilterLabel?: (key: string, value: string, refId?: string) => void;
  onClickFilterOutLabel?: (key: string, value: string, refId?: string) => void;
  isFilterLabelActive?: (key: string, value: string, refId?: string) => Promise<boolean>;
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
    ...rest
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
            <PopoverMenuHandler styles={styles} {...rest}>
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
  onClickFilterLabel?: (key: string, value: string, refId?: string) => void;
  onClickFilterOutLabel?: (key: string, value: string, refId?: string) => void;
  isFilterLabelActive?: (key: string, value: string, refId?: string) => Promise<boolean>;
}

const PopoverMenuHandler = ({ children, styles, ...rest }: PopoverMenuHandlerProps) => {
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [xCoordinate, setXcoordinate] = useState(0);
  const [selection, setSelection] = useState('');
  const [keyValueSelection, setKeyValueSelection] = useState({ key: '', value: '' });

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
    const currentSelection = document.getSelection()?.toString();
    console.log(currentSelection);
    if (!currentSelection) {
      return;
    }
    const position = e.currentTarget.getBoundingClientRect();
    setShowContextMenu(true);
    setXcoordinate(e.clientX - position.left);
    setSelection(currentSelection);
    setKeyValueSelection(parseKeyValue(currentSelection));
  }, []);

  return (
    <div style={{ position: "relative" }}>
      {showContextMenu && <PopoverMenu selection={selection} keyValueSelection={keyValueSelection} left={xCoordinate} {...rest} />}
      <button className={`${styles.logLine} ${styles.positionRelative}`} onClick={handlePropagation} onMouseUp={handleSelection}>
        <>{children}</>
      </button>
    </div>
  )
}

interface PopoverMenuProps {
  selection: string;
  keyValueSelection: { key: string, value: string };
  left: number;
  onClickFilterLabel?: (key: string, value: string, refId?: string) => void;
  onClickFilterOutLabel?: (key: string, value: string, refId?: string) => void;
  isFilterLabelActive?: (key: string, value: string, refId?: string) => Promise<boolean>;
}

const PopoverMenu = ({ left, isFilterLabelActive, onClickFilterLabel, onClickFilterOutLabel, selection, keyValueSelection }: PopoverMenuProps) => {
  const [isFilterActive, setIsFilterActive] = useState(false);
  useEffect(() => {
    if (!onClickFilterLabel || !keyValueSelection.key || !keyValueSelection.value) {
      return;
    }
    isFilterLabelActive?.(keyValueSelection.key, keyValueSelection.value).then(setIsFilterActive);
  }, [isFilterLabelActive, keyValueSelection.key, keyValueSelection.value, onClickFilterLabel]);

  if (!onClickFilterLabel || !onClickFilterOutLabel) {
    return null;
  }

  const parsedKeyValue = keyValueSelection.key && keyValueSelection.value ? `${keyValueSelection.key}=${keyValueSelection.value}` : '';

  return (
    <div style={{ position: "absolute", top: 0, left, zIndex: 9999 }}>
      <Menu>
        <Menu.Item label="Copy" onClick={() => {}} />
        {parsedKeyValue && (
          <>
            <Menu.Item label={isFilterActive ? "Remove from query" : `Filter for ${parsedKeyValue}`} onClick={() => onClickFilterLabel(keyValueSelection.key, keyValueSelection.value)} />
            <Menu.Item label={`Filter out ${parsedKeyValue}`} onClick={() => onClickFilterOutLabel(keyValueSelection.key, keyValueSelection.value)} />
          </>
        )}
        <Menu.Item label="Add as line filter" onClick={() => {}} />
      </Menu>
    </div>
  );
}

LogRowMessage.displayName = 'LogRowMessage';
