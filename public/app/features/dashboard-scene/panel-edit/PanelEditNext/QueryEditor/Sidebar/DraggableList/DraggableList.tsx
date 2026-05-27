import { css } from '@emotion/css';
import { DragDropContext, Draggable, Droppable, type DropResult } from '@hello-pangea/dnd';
import { type ReactNode } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { useStyles2, useTheme2 } from '@grafana/ui';

import { SIDEBAR_CARD_HEIGHT, SIDEBAR_CARD_INDENT, SIDEBAR_CARD_SPACING } from '../../../constants';

import { useDropIndicator } from './useDropIndicator';

interface DraggableListProps<T> {
  droppableId: string;
  items: T[];
  keyExtractor: (item: T) => string;
  renderItem: (item: T) => ReactNode;
  onDragStart?: () => void;
  onDragEnd: (result: DropResult) => void;
}

export function DraggableList<T>({
  droppableId,
  items,
  keyExtractor,
  renderItem,
  onDragStart,
  onDragEnd,
}: DraggableListProps<T>) {
  const styles = useStyles2(getStyles);
  const theme = useTheme2();

  const { indicator, containerRef, handleBeforeCapture, handleDragStart, handleDragUpdate, handleDragEnd } =
    useDropIndicator({
      itemHeight: SIDEBAR_CARD_HEIGHT,
      itemSpacing: theme.spacing.gridSize * SIDEBAR_CARD_SPACING,
      onDragStart,
      onDragEnd,
    });

  return (
    <DragDropContext
      onBeforeCapture={handleBeforeCapture}
      onDragStart={handleDragStart}
      onDragUpdate={handleDragUpdate}
      onDragEnd={handleDragEnd}
    >
      <Droppable droppableId={droppableId} direction="vertical">
        {(dropProvided) => (
          <div
            ref={(el) => {
              dropProvided.innerRef(el);
              containerRef.current = el;
            }}
            {...dropProvided.droppableProps}
            className={styles.droppable}
          >
            {items.map((item, index) => {
              const key = keyExtractor(item);
              return (
                <Draggable key={key} draggableId={key} index={index}>
                  {(dragProvided, dragSnapshot) => (
                    <div
                      ref={dragProvided.innerRef}
                      {...dragProvided.draggableProps}
                      {...dragProvided.dragHandleProps}
                      tabIndex={-1}
                      className={styles.draggableItem}
                      data-is-dragging={dragSnapshot.isDragging || undefined}
                    >
                      {renderItem(item)}
                    </div>
                  )}
                </Draggable>
              );
            })}
            {indicator && (
              <div className={styles.dropIndicator} style={{ top: indicator.top, height: indicator.height }} />
            )}
            {dropProvided.placeholder}
          </div>
        )}
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
