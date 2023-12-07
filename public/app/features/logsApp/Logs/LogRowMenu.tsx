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
  onSimilarityChange: (row: LogRowModel, type: 'show' | 'hide') => void;
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
  ({
    onOpenContext,
    onPermalinkClick,
    row,
    showContextToggle,
    styles,
    prettifyLogMessage,
    onSimilarityChange,
  }: Props) => {
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
        <IconButton
          tooltip="Show similar log lines"
          variant="secondary"
          aria-label="Show similar log lines"
          tooltipPlacement="top"
          size="lg"
          name="search-plus"
          onClick={() => {
            onSimilarityChange(row, 'show');
          }}
          className={styles.detailsMenuIcon}
        />
        <IconButton
          tooltip="Hide similar log lines"
          variant="secondary"
          aria-label="Hide similar log lines"
          tooltipPlacement="top"
          size="lg"
          name="search-minus"
          onClick={() => {
            onSimilarityChange(row, 'hide');
          }}
          className={styles.detailsMenuIcon}
        />
      </div>
    );
  }
);

LogRowMenu.displayName = 'LogRowMenu';
