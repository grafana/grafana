import { DragDropContext, Droppable, type DropResult } from '@hello-pangea/dnd';

import { t } from '@grafana/i18n';
import { Box, FieldSet, Text } from '@grafana/ui';

import { PlaylistTableRows } from './PlaylistTableRows';
import { type PlaylistItemUI } from './types';

interface Props {
  items: PlaylistItemUI[];
  deleteItem: (idx: number) => void;
  moveItem: (src: number, dst: number) => void;
  /** Placeholder for empty per-item intervals; the global interval used as fallback during playback. */
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
      {items.length > 0 && (
        <Box marginBottom={1}>
          <Text variant="bodySmall" color="secondary">
            {t(
              'playlist-edit.form.table-interval-help',
              'Optionally set a per-dashboard interval. Leave blank to use the interval above.'
            )}
          </Text>
        </Box>
      )}
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
