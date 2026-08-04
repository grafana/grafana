import { DragDropContext, Droppable, type DropResult } from '@hello-pangea/dnd';

import { t } from '@grafana/i18n';
import { Box, FieldSet, Text } from '@grafana/ui';

import { PlaylistTableRows } from './PlaylistTableRows';
import { type PlaylistItemUI } from './types';

interface Props {
  items: PlaylistItemUI[];
  deleteItem: (idx: number) => void;
  duplicateItem: (idx: number) => void;
  moveItem: (src: number, dst: number) => void;
  /** Placeholder for empty per-item intervals; the global interval used as fallback during playback. */
  intervalPlaceholder?: string;
  updateItemInterval?: (idx: number, interval: string) => void;
  updateItemDashboardView?: (idx: number, queryString: string) => void;
}

export const PlaylistTable = ({
  items,
  deleteItem,
  duplicateItem,
  moveItem,
  intervalPlaceholder,
  updateItemInterval,
  updateItemDashboardView,
}: Props) => {
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
              'playlist-edit.form.table-item-settings-help',
              'Use Settings to configure a custom dashboard view or interval for each playlist item.'
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
                  onDuplicate={duplicateItem}
                  intervalPlaceholder={intervalPlaceholder}
                  onUpdateInterval={updateItemInterval}
                  onUpdateDashboardView={updateItemDashboardView}
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
