import React, { FocusEvent, SyntheticEvent, useCallback, useState } from 'react';

import { DataLinkClickEvent, LogRowModel } from '@grafana/data';
import { ClipboardButton, Dropdown, IconButton, Menu } from '@grafana/ui';

import { LogRowStyles } from './getLogRowStyles';

interface Props {
  logText: string;
  row: LogRowModel;
  showContextToggle?: (row: LogRowModel) => boolean;
  onOpenContext: (row: LogRowModel) => void;
  onPermalinkClick?: (row: LogRowModel) => Promise<void>;
  onPinLine?: (row: LogRowModel) => void;
  onUnpinLine?: (row: LogRowModel) => void;
  pinned?: boolean;
  styles: LogRowStyles;
  mouseIsOver: boolean;
  onBlur?: () => void;
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
    const [isLinkMenuOpen, setIsLinkMenuOpen] = useState(false);

    const links = row.links
      ? row.links
          .map((link) => {
            return link.url ? { title: link.title, url: link.url, onClick: link.onClick } : undefined;
          })
          .filter(
            (v): v is { title: string; url: string; onClick: ((event: DataLinkClickEvent<any>) => void) | undefined } =>
              v !== undefined
          )
          .flat()
      : [];

    const MenuActions = (
      <Menu>
        {links.map((link, i) => (
          <Menu.Item
            key={`link-menu-${i}`}
            label={link.title}
            onClick={(e) => {
              if (link.onClick) {
                link.onClick(e as any);
              }
            }}
          />
        ))}
      </Menu>
    );

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
            {links.length > 0 && (
              <Dropdown overlay={MenuActions} placement="bottom-end" onVisibleChange={setIsLinkMenuOpen}>
                <IconButton
                  tooltip="Open links"
                  aria-label="Open links"
                  tooltipPlacement="top"
                  size="md"
                  name="link"
                  onClick={() => setIsLinkMenuOpen(!isLinkMenuOpen)}
                  tabIndex={0}
                />
              </Dropdown>
            )}
          </>
        )}
      </span>
    );
  }
);

LogRowMenuCell.displayName = 'LogRowMenuCell';
