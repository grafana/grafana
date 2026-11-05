import { DragDropContext, Droppable, type DropResult } from '@hello-pangea/dnd';

import { t } from '@grafana/i18n';
import { FieldSet } from '@grafana/ui';

import { PlaylistTableRows } from './PlaylistTableRows';
import { type PlaylistItemUI } from './types';

interface Props {
  items: PlaylistItemUI[];
  deleteItem: (idx: number) => void;
  moveItem: (src: number, dst: number) => void;
  /** Placeholder for blank per-item intervals (the global interval). */
  intervalPlaceholder?: string;
  updateItemInterval?: (idx: number, interval: string) => void;
}

export const PlaylistTable = ({ items, deleteItem, moveItem, intervalPlaceholder, updateItemInterval }: Props) => {
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
                <PlaylistTableRows
                  items={items}
                  onDelete={deleteItem}
                  intervalPlaceholder={intervalPlaceholder}
                  onUpdateInterval={updateItemInterval}
                />
                {provided.placeholder}
              </div>
            );
          }}
        </Droppable>
      </DragDropContext>
    </FieldSet>
  );
};
