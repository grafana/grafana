import { css } from '@emotion/css';
import {
  type DraggableProvided,
  type DraggableStateSnapshot,
  type DroppableProvided,
  type DropResult,
} from '@hello-pangea/dnd';
import { type ReactNode } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { useStyles2, useTheme2 } from '@grafana/ui';
import { useDragAndDrop } from 'app/core/components/DragAndDrop/useDragAndDrop';

import { SIDEBAR_CARD_HEIGHT, SIDEBAR_CARD_INDENT, SIDEBAR_CARD_SPACING } from '../../../constants';

import { useDropIndicator } from './useDropIndicator';

interface DraggableListProps<T> {
  droppableId: string;
  items: T[];
  keyExtractor: (item: T) => string;
  renderItem: (item: T) => ReactNode;
  onDragStart?: () => void;
  onDragEnd: (result: DropResult) => void;
  isDragDisabled?: boolean;
}

export function DraggableList<T>({
  droppableId,
  items,
  keyExtractor,
  renderItem,
  onDragStart,
  onDragEnd,
  isDragDisabled = false,
}: DraggableListProps<T>) {
  const styles = useStyles2(getStyles);
  const theme = useTheme2();
  const dragAndDrop = useDragAndDrop();

  const { indicator, containerRef, handleBeforeCapture, handleDragStart, handleDragUpdate, handleDragEnd } =
    useDropIndicator({
      itemHeight: SIDEBAR_CARD_HEIGHT,
      itemSpacing: theme.spacing.gridSize * SIDEBAR_CARD_SPACING,
      onDragStart,
      onDragEnd,
    });

  const renderDraggableItem = (
    item: T,
    key: string,
    dragProvided?: DraggableProvided,
    dragSnapshot?: DraggableStateSnapshot
  ) => (
    <div
      key={key}
      ref={dragProvided?.innerRef}
      {...dragProvided?.draggableProps}
      {...dragProvided?.dragHandleProps}
      tabIndex={-1}
      className={styles.draggableItem}
      data-is-dragging={dragSnapshot?.isDragging || undefined}
    >
      {renderItem(item)}
    </div>
  );

  const renderItems = (dropProvided?: DroppableProvided) => (
    <div
      ref={(element) => {
        dropProvided?.innerRef(element);
        containerRef.current = element;
      }}
      {...dropProvided?.droppableProps}
      className={styles.droppable}
    >
      {items.map((item, index) => {
        const key = keyExtractor(item);

        if (!dragAndDrop) {
          return renderDraggableItem(item, key);
        }

        const { Draggable } = dragAndDrop;
        return (
          <Draggable key={key} draggableId={key} index={index} isDragDisabled={isDragDisabled}>
            {(dragProvided, dragSnapshot) => renderDraggableItem(item, key, dragProvided, dragSnapshot)}
          </Draggable>
        );
      })}
      {indicator && <div className={styles.dropIndicator} style={{ top: indicator.top, height: indicator.height }} />}
      {dropProvided?.placeholder}
    </div>
  );

  if (!dragAndDrop) {
    return renderItems();
  }

  const { DragDropContext, Droppable } = dragAndDrop;

  return (
    <DragDropContext
      onBeforeCapture={handleBeforeCapture}
      onDragStart={handleDragStart}
      onDragUpdate={handleDragUpdate}
      onDragEnd={handleDragEnd}
    >
      <Droppable droppableId={droppableId} direction="vertical">
        {(dropProvided) => renderItems(dropProvided)}
      </Droppable>
    </DragDropContext>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    droppable: css({
      display: 'flex',
      flexDirection: 'column',
      position: 'relative',
    }),
    draggableItem: css({
      marginBottom: theme.spacing(SIDEBAR_CARD_SPACING),
      '&:last-child': {
        marginBottom: 0,
      },
      '[data-dragging] &': {
        pointerEvents: 'none',
      },
    }),
    dropIndicator: css({
      position: 'absolute',
      left: theme.spacing(SIDEBAR_CARD_INDENT),
      right: theme.spacing(SIDEBAR_CARD_INDENT),
      background: theme.colors.primary.transparent,
      pointerEvents: 'none',
      borderRadius: theme.shape.radius.default,
      overflow: 'hidden',
      '&::before': {
        content: '""',
        position: 'absolute',
        left: 0,
        top: 0,
        bottom: 0,
        width: 3,
        background: theme.colors.primary.border,
      },
    }),
  };
}
