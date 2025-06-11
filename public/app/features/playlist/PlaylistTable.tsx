import { DragDropContext, Droppable, DropResult } from '@hello-pangea/dnd';

import { t } from '@grafana/i18n';
import { FieldSet } from '@grafana/ui';

import { PlaylistTableRows } from './PlaylistTableRows';
import { PlaylistItemUI } from './types';

interface Props {
  items: PlaylistItemUI[];
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
    <FieldSet label={t('playlist-edit.form.table-heading', 'Dashboards')}>
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
    </FieldSet>
  );
};
