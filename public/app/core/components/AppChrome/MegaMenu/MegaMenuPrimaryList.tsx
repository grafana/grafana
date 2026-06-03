import { DragDropContext, Draggable, Droppable, type DropResult } from '@hello-pangea/dnd';

import { type NavModelItem } from '@grafana/data';

import { MegaMenuItem } from './MegaMenuItem';

interface Props {
  items: NavModelItem[];
  activeItem?: NavModelItem;
  isPinned: (id?: string) => boolean;
  onPin: (item: NavModelItem) => void;
  onClick?: () => void;
  onReorder?: (sourceId: string, destinationId: string) => void;
  enableDragAndDrop?: boolean;
}

export function MegaMenuPrimaryList({
  items,
  activeItem,
  isPinned,
  onPin,
  onClick,
  onReorder,
  enableDragAndDrop,
}: Props) {
  const onDragEnd = (result: DropResult) => {
    if (!result.destination || !onReorder) {
      return;
    }
    const sourceId = result.draggableId;
    const destinationId = items[result.destination.index]?.id;
    if (destinationId) {
      onReorder(sourceId, destinationId);
    }
  };

  const renderItems = () =>
    items.map((link, index) => {
      const id = link.id ?? link.text;
      return (
        <MegaMenuItem
          key={id}
          link={link}
          isPinned={isPinned}
          onClick={onClick}
          activeItem={activeItem}
          onPin={onPin}
        />
      );
    });

  if (!enableDragAndDrop || !onReorder) {
    return <>{renderItems()}</>;
  }

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <Droppable droppableId="megamenu-primary">
        {(provided) => (
          <div ref={provided.innerRef} {...provided.droppableProps}>
            {items.map((link, index) => {
              const id = link.id ?? link.text;
              return (
                <Draggable key={id} draggableId={id} index={index}>
                  {(dragProvided) => (
                    <MegaMenuItem
                      link={link}
                      isPinned={isPinned}
                      onClick={onClick}
                      activeItem={activeItem}
                      onPin={onPin}
                      innerRef={dragProvided.innerRef}
                      draggableProps={dragProvided.draggableProps}
                      dragHandleProps={dragProvided.dragHandleProps}
                    />
                  )}
                </Draggable>
              );
            })}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </DragDropContext>
  );
}
