import { DragDropContext, Droppable, DropResult } from '@hello-pangea/dnd';

import { FieldSet } from '@grafana/ui';
import { t } from 'app/core/internationalization';

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
    <>
      {/* BMC Code : Accessibility Change (Next 1 line) */}
      <FieldSet label={t('playlist-edit.form.table-heading', 'Dashboards')} role="application">
        <DragDropContext onDragEnd={onDragEnd}>
          <Droppable droppableId="playlist-list" direction="vertical">
            {(provided) => {
              return (
                <div 
                  ref={provided.innerRef} 
                  {...provided.droppableProps}
                  // BMC Code : Accessibility Change ( next 2 line)
                  role="list"
                  aria-label={t('playlist-edit.form.table-heading', 'Dashboards')}>
                  <PlaylistTableRows items={items} onDelete={deleteItem} />
                  {provided.placeholder}
                </div>
              );
            }}
          </Droppable>
        </DragDropContext>
      </FieldSet>

      {/* BMC Code : Accessibility Change (Next 5 line) */}
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {items.length > 0
          ? `Playlist items changed. There are ${items.length} dashboards in playlist now.`
          : 'Playlist is empty. Add dashboards below.'}
      </div>
    </>
  );
};
