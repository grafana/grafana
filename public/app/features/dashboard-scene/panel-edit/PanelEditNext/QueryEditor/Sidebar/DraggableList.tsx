import { DragDropContext, Draggable, Droppable, DropResult } from '@hello-pangea/dnd';
import { ReactNode } from 'react';

import { Stack } from '@grafana/ui';

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
  return (
    <DragDropContext onDragStart={onDragStart} onDragEnd={onDragEnd}>
      <Droppable droppableId={droppableId} direction="vertical">
        {(provided) => (
          <Stack ref={provided.innerRef} {...provided.droppableProps} direction="column" gap={1}>
            {items.map((item, index) => {
              const key = keyExtractor(item);
              return (
                <Draggable key={key} draggableId={key} index={index}>
                  {(provided) => (
                    <div ref={provided.innerRef} {...provided.draggableProps} {...provided.dragHandleProps}>
                      {renderItem(item)}
                    </div>
                  )}
                </Draggable>
              );
            })}
            {provided.placeholder}
          </Stack>
        )}
      </Droppable>
    </DragDropContext>
  );
}
