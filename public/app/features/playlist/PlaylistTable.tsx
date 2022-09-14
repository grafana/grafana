import React from 'react';
import { DragDropContext, Droppable, DropResult } from 'react-beautiful-dnd';

import { PlaylistTableRows } from './PlaylistTableRows';
import { PlaylistItem } from './types';

interface Props {
  items: PlaylistItem[];
  deleteItem: (idx: number) => void;
  moveItem: (src: number, dst: number) => void;
}

export const PlaylistTable = ({ items, deleteItem, moveItem }: Props) => {
  const onDragEnd = (d: DropResult) => {
    if (d.destination) {
      moveItem(d.source.index, d.destination?.index);
    }
  };

  return (
    <div className="gf-form-group">
      <h3 className="page-headering">Dashboards</h3>

      <DragDropContext onDragEnd={onDragEnd}>
        <Droppable droppableId="playlist-list" direction="vertical">
          {(provided) => {
            return (
              <div ref={provided.innerRef} {...provided.droppableProps}>
                <PlaylistTableRows items={items} onDelete={deleteItem} />
                {provided.placeholder}
              </div>
            );
          }}
        </Droppable>
      </DragDropContext>
    </div>
  );
};
