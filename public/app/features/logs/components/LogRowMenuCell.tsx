import React, { FocusEvent, SyntheticEvent, useCallback } from 'react';

import { LogRowModel } from '@grafana/data';
import { ClipboardButton, IconButton } from '@grafana/ui';

import { LogRowStyles } from './getLogRowStyles';

interface Props {
  logText: string;
  row: LogRowModel;
  showContextToggle?: (row?: LogRowModel) => boolean;
  onOpenContext: (row: LogRowModel) => void;
  onPermalinkClick?: (row: LogRowModel) => Promise<void>;
  onPinLine?: (row: LogRowModel) => void;
  onUnpinLine?: (row: LogRowModel) => void;
  pinned?: boolean;
  styles: LogRowStyles;
  mouseIsOver: boolean;
  onBlur: () => void;
  expandAllLogs?: boolean;
  expandLogMessage?: (expandLogMessage: (currnet: boolean) => boolean) => void;
}

export const LogRowMenuCell = React.memo(
  ({
    logText,
    onOpenContext,
    onPermalinkClick,
    onPinLine,
    onUnpinLine,
    pinned,
    row,
    showContextToggle,
    styles,
    mouseIsOver,
    onBlur,
    expandLogMessage,
    expandAllLogs,
  }: Props) => {
    const shouldShowContextToggle = showContextToggle ? showContextToggle(row) : false;
    const onLogRowClick = useCallback((e: SyntheticEvent) => {
      e.stopPropagation();
    }, []);
    const onExpandLogClick = () => {
      if (expandLogMessage !== undefined) {
        expandLogMessage((current) => {
          console.log('will become: ' + !current);
          return !current;
        });
      }
    };
    const onShowContextClick = useCallback(
      (e: SyntheticEvent<HTMLElement, Event>) => {
        e.stopPropagation();
        onOpenContext(row);
      },
      [onOpenContext, row]
    );
    /**
     * For better accessibility support, we listen to the onBlur event here (to hide this component), and
     * to onFocus in LogRow (to show this component).
     */
    const handleBlur = useCallback(
      (e: FocusEvent) => {
        if (!e.currentTarget.contains(e.relatedTarget) && onBlur) {
          onBlur();
        }
      },
      [onBlur]
    );
    const getLogText = useCallback(() => logText, [logText]);
    return (
      // We keep this click listener here to prevent the row from being selected when clicking on the menu.
      // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
      <span className={`log-row-menu ${styles.rowMenu}`} onClick={onLogRowClick} onBlur={handleBlur}>
        {pinned && !mouseIsOver && (
          <IconButton
            className={styles.unPinButton}
            size="md"
            name="gf-pin"
            onClick={() => onUnpinLine && onUnpinLine(row)}
            tooltip="Unpin line"
            tooltipPlacement="top"
            aria-label="Unpin line"
            tabIndex={0}
          />
        )}
        {mouseIsOver && (
          <>
            {expandAllLogs && (
              <IconButton
                size="md"
                name="expand-arrows"
                onClick={onExpandLogClick}
                tooltip="Expand log"
                tooltipPlacement="top"
                aria-label="Expand log"
                tabIndex={0}
              />
            )}
            {shouldShowContextToggle && (
              <IconButton
                size="md"
                name="gf-show-context"
                onClick={onShowContextClick}
                tooltip="Show context"
                tooltipPlacement="top"
                aria-label="Show context"
                tabIndex={0}
              />
            )}
            <ClipboardButton
              className={styles.copyLogButton}
              icon="copy"
              variant="secondary"
              fill="text"
              size="md"
              getText={getLogText}
              tooltip="Copy to clipboard"
              tooltipPlacement="top"
              tabIndex={0}
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
                tabIndex={0}
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
                tabIndex={0}
              />
            )}
            {onPermalinkClick && row.rowId !== undefined && row.uid && (
              <IconButton
                tooltip="Copy shortlink"
                aria-label="Copy shortlink"
                tooltipPlacement="top"
                size="md"
                name="share-alt"
                onClick={() => onPermalinkClick(row)}
                tabIndex={0}
              />
            )}
          </>
        )}
      </span>
    );
  }
);

LogRowMenuCell.displayName = 'LogRowMenuCell';
