import { cx } from '@emotion/css';
import memoizeOne from 'memoize-one';
import React, { PureComponent } from 'react';
import Highlighter from 'react-highlight-words';

import { CoreApp, findHighlightChunksInText, LogRowModel } from '@grafana/data';
import { ClipboardButton, IconButton } from '@grafana/ui';

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

  onLogRowClick = (e: React.SyntheticEvent) => {
    e.stopPropagation();
  };

  getLogText = () => {
    const { row, prettifyLogMessage } = this.props;
    const { raw } = row;
    return restructureLog(raw, prettifyLogMessage);
  };

  render() {
    const {
      row,
      wrapLogMessage,
      prettifyLogMessage,
      showContextToggle,
      styles,
      onPermalinkClick,
      onUnpinLine,
      onPinLine,
      pinned,
    } = this.props;
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
          {pinned && (
            // TODO: fix keyboard a11y
            // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
            <span className={cx('log-row-menu', 'log-row-menu-visible', styles.rowMenu)} onClick={this.onLogRowClick}>
              <IconButton
                className={styles.unPinButton}
                size="md"
                name="gf-pin"
                onClick={() => onUnpinLine && onUnpinLine(row)}
                tooltip="Unpin line"
                tooltipPlacement="top"
                aria-label="Unpin line"
              />
            </span>
          )}
          {/* TODO: fix keyboard a11y */}
          {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
          <span className={cx('log-row-menu', styles.rowMenu, styles.hidden)} onClick={this.onLogRowClick}>
            {shouldShowContextToggle && (
              <IconButton
                size="md"
                name="gf-show-context"
                onClick={this.onShowContextClick}
                tooltip="Show context"
                tooltipPlacement="top"
                aria-label="Show context"
              />
            )}
            <ClipboardButton
              className={styles.copyLogButton}
              icon="copy"
              variant="secondary"
              fill="text"
              size="md"
              getText={this.getLogText}
              tooltip="Copy to clipboard"
              tooltipPlacement="top"
            />
            {pinned && onUnpinLine && (
              <IconButton
                className={styles.unPinButton}
                size="md"
                name="gf-pin"
                onClick={() => onUnpinLine && onUnpinLine(row)}
                tooltip="Unpin line"
                tooltipPlacement="top"
                aria-label="Unpin line"
              />
            )}
            {!pinned && onPinLine && (
              <IconButton
                className={styles.unPinButton}
                size="md"
                name="gf-pin"
                onClick={() => onPinLine && onPinLine(row)}
                tooltip="Pin line"
                tooltipPlacement="top"
                aria-label="Pin line"
              />
            )}
            {onPermalinkClick && row.uid && (
              <IconButton
                tooltip="Copy shortlink"
                aria-label="Copy shortlink"
                tooltipPlacement="top"
                size="md"
                name="share-alt"
                onClick={() => onPermalinkClick(row)}
              />
            )}
          </span>
        </td>
      </>
    );
  }
}
