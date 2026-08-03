import { css } from '@emotion/css';
import memoize from 'micro-memoize';
import { type KeyboardEvent, type PointerEvent, type RefObject, useState } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';

import { useStyles2 } from '../../../../themes/ThemeContext';
import { TABLE } from '../constants';

interface ColumnFreezeDividerProps {
  gridRef: RefObject<HTMLDivElement>;
  columnCount: number;
  pinnedColumnCount: number;
  pinnedWidth: number;
  onPinnedColumnCountChange: (count: number) => void;
}

interface DividerPosition {
  count: number;
  left: number;
}

export function ColumnFreezeDivider({
  gridRef,
  columnCount,
  pinnedColumnCount,
  pinnedWidth,
  onPinnedColumnCountChange,
}: ColumnFreezeDividerProps) {
  const styles = useStyles2(getStyles);
  const [dragPosition, setDragPosition] = useState<DividerPosition>();
  const isDragging = dragPosition != null;
  const left = dragPosition?.left ?? pinnedWidth;

  const getPosition = (clientX: number): DividerPosition => {
    const grid = gridRef.current;
    if (!grid) {
      return { count: pinnedColumnCount, left: pinnedWidth };
    }

    const gridRect = grid.getBoundingClientRect();
    const headerCells = Array.from(
      grid.querySelectorAll<HTMLElement>('.rdg-header-row > [role="columnheader"]:not([aria-hidden="true"])')
    );
    let count = 0;
    let boundary = 0;

    for (let index = 0; index < headerCells.length; index++) {
      const rect = headerCells[index].getBoundingClientRect();
      if (clientX < (rect.left + rect.right) / 2) {
        break;
      }
      count = index + 1;
      boundary = rect.right - gridRect.left;
    }

    return {
      count: Math.min(count, columnCount),
      left: Math.max(0, Math.min(boundary, gridRect.width)),
    };
  };

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragPosition(getPosition(event.clientX));
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!isDragging) {
      return;
    }
    setDragPosition(getPosition(event.clientX));
  };

  const handlePointerUp = (event: PointerEvent<HTMLDivElement>) => {
    if (!isDragging) {
      return;
    }
    const next = getPosition(event.clientX);
    event.currentTarget.releasePointerCapture(event.pointerId);
    setDragPosition(undefined);
    onPinnedColumnCountChange(next.count);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    let nextCount = pinnedColumnCount;
    if (event.key === 'ArrowLeft') {
      nextCount--;
    } else if (event.key === 'ArrowRight') {
      nextCount++;
    } else if (event.key === 'Home') {
      nextCount = 0;
    } else if (event.key === 'End') {
      nextCount = columnCount;
    } else {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    onPinnedColumnCountChange(Math.max(0, Math.min(nextCount, columnCount)));
  };

  return (
    <>
      {isDragging && <div className={styles.preview} style={{ width: left }} />}
      <div className={styles.line} style={{ left }} data-dragging={isDragging || undefined} />
      <div
        className={styles.handle}
        style={{ left }}
        role="slider"
        aria-label={t('grafana-ui.table.freeze-divider-label', 'Pinned column boundary')}
        aria-orientation="vertical"
        aria-valuemin={0}
        aria-valuemax={columnCount}
        aria-valuenow={dragPosition?.count ?? pinnedColumnCount}
        tabIndex={0}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={() => setDragPosition(undefined)}
        onKeyDown={handleKeyDown}
      />
    </>
  );
}

const getStyles = memoize((theme: GrafanaTheme2) => ({
  preview: css({
    label: 'columnFreezePreview',
    position: 'absolute',
    insetBlock: 0,
    insetInlineStart: 0,
    zIndex: theme.zIndex.tooltip - 8,
    pointerEvents: 'none',
    background: theme.colors.primary.transparent,
  }),
  line: css({
    label: 'columnFreezeDivider',
    position: 'absolute',
    insetBlock: 0,
    zIndex: theme.zIndex.tooltip - 2,
    width: 2,
    transform: 'translateX(-1px)',
    pointerEvents: 'none',
    background: theme.colors.border.medium,
    '&[data-dragging]': {
      background: theme.colors.primary.main,
    },
  }),
  handle: css({
    label: 'columnFreezeHandle',
    position: 'absolute',
    insetBlockStart: 0,
    zIndex: theme.zIndex.tooltip,
    width: 16,
    height: TABLE.HEADER_HEIGHT,
    transform: 'translateX(-8px)',
    cursor: 'ew-resize',
    touchAction: 'none',
    padding: 0,
    border: 0,
    background: 'transparent',
    outline: 'none',
    '&::before': {
      content: '""',
      position: 'absolute',
      insetBlockStart: theme.spacing(0.75),
      insetInlineStart: 6,
      width: 4,
      height: TABLE.HEADER_HEIGHT - theme.spacing.gridSize * 1.5,
      borderRadius: theme.shape.radius.pill,
      background: theme.colors.border.strong,
    },
    '&:hover::before, &:focus-visible::before': {
      background: theme.colors.primary.main,
    },
    '&:focus-visible': {
      boxShadow: `inset 0 0 0 2px ${theme.colors.primary.main}`,
      borderRadius: theme.shape.radius.default,
    },
  }),
}));
