import React, { SyntheticEvent, useCallback } from 'react';

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
  }: Props) => {
    const shouldShowContextToggle = showContextToggle ? showContextToggle(row) : false;
    const onLogRowClick = useCallback((e: SyntheticEvent) => {
      e.stopPropagation();
    }, []);
    const onShowContextClick = useCallback(
      (e: SyntheticEvent<HTMLElement, Event>) => {
        e.stopPropagation();
        onOpenContext(row);
      },
      [onOpenContext, row]
    );
    const getLogText = useCallback(() => logText, [logText]);
    return (
      <>
        {pinned && (
          // TODO: fix keyboard a11y
          // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
          <span className={`log-row-menu log-row-menu-visible ${styles.rowMenu}`} onClick={onLogRowClick}>
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
        <span className={`log-row-menu ${styles.rowMenu} ${styles.hidden}`} onClick={onLogRowClick}>
          {shouldShowContextToggle && (
            <IconButton
              size="md"
              name="gf-show-context"
              onClick={onShowContextClick}
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
            getText={getLogText}
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
      </>
    );
  }
);

LogRowMenuCell.displayName = 'LogRowMenuCell';
