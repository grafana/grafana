import { css } from '@emotion/css';
import { DragDropContext, Draggable, Droppable, DropResult } from '@hello-pangea/dnd';
import { ReactNode } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

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
  const { indicator, containerRef, setItemRef, handleBeforeCapture, handleDragStart, handleDragUpdate, handleDragEnd } =
    useDropIndicator({ itemCount: items.length, onDragStart, onDragEnd });

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
                  {(dragProvided) => (
                    <div
                      ref={(el) => {
                        dragProvided.innerRef(el);
                        setItemRef(index, el);
                      }}
                      {...dragProvided.draggableProps}
                      {...dragProvided.dragHandleProps}
                      className={styles.draggableItem}
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
      marginBottom: theme.spacing(1),
    }),
    dropIndicator: css({
      position: 'absolute',
      left: theme.spacing(2),
      right: 0,
      background: theme.colors.primary.transparent,
      borderLeft: `1px solid ${theme.colors.primary.border}`,
      pointerEvents: 'none',
    }),
  };
}
