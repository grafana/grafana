import React, { SyntheticEvent, useCallback, useMemo } from 'react';

import { LogRowModel } from '@grafana/data';
import { ClipboardButton, IconButton } from '@grafana/ui';
import { LogRowStyles } from 'app/features/logs/components/getLogRowStyles';

interface Props {
  row: LogRowModel;
  showContextToggle?: (row: LogRowModel) => boolean;
  prettifyLogMessage: boolean;
  onOpenContext: (row: LogRowModel) => void;
  onPermalinkClick?: (row: LogRowModel) => Promise<void>;
  pinned?: boolean;
  styles: LogRowStyles;
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

export const LogRowMenu = React.memo(
  ({ onOpenContext, onPermalinkClick, row, showContextToggle, styles, prettifyLogMessage }: Props) => {
    const { raw } = row;
    const restructuredEntry = useMemo(() => restructureLog(raw, prettifyLogMessage), [raw, prettifyLogMessage]);
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
    const getLogText = useCallback(() => restructuredEntry, [restructuredEntry]);
    return (
      // We keep this click listener here to prevent the row from being selected when clicking on the menu.
      // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
      <div className={styles.detailsMenu} onClick={onLogRowClick}>
        {shouldShowContextToggle && (
          <IconButton
            size="md"
            variant="secondary"
            name="gf-show-context"
            onClick={onShowContextClick}
            tooltip="Show context"
            tooltipPlacement="top"
            aria-label="Show context"
            className={styles.detailsMenuIcon}
          />
        )}
        <ClipboardButton
          icon="copy"
          variant="secondary"
          fill="text"
          size="md"
          getText={getLogText}
          tooltip="Copy to clipboard"
          tooltipPlacement="top"
          className={styles.detailsMenuCopyIcon}
        />
        {onPermalinkClick && row.rowId !== undefined && row.uid && (
          <IconButton
            tooltip="Copy shortlink"
            variant="secondary"
            aria-label="Copy shortlink"
            tooltipPlacement="top"
            size="md"
            name="share-alt"
            onClick={() => onPermalinkClick(row)}
            className={styles.detailsMenuIcon}
          />
        )}
      </div>
    );
  }
);

LogRowMenu.displayName = 'LogRowMenu';
