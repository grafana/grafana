import { css } from '@emotion/css';
import { type ReactNode } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { IconButton, Text, useStyles2 } from '@grafana/ui';

import { DraggableListItem } from './DraggableListItem';
import { DroppableCategory } from './DroppableCategory';
import { selectors } from '@grafana/e2e-selectors';

interface DraggableListProps<T extends { state: { key?: string; name: string } }> {
  items: T[];
  droppableId: string;
  title: string;
  onEditItem: (item: T) => void;
  onDuplicateItem: (item: T) => void;
  onDeleteItem: (item: T) => void;
  renderItemLabel: (item: T) => NonNullable<ReactNode>;
}

export function DraggableList<T extends { state: { key?: string; name: string } }>({
  items,
  droppableId,
  title,
  onEditItem,
  onDuplicateItem,
  onDeleteItem,
  renderItemLabel,
}: DraggableListProps<T>) {
  const styles = useStyles2(getStyles);

  return (
    <DroppableCategory droppableId={droppableId} title={title} itemsCount={items.length}>
      <ul className={styles.list} data-testid={droppableId}>
        {items.map((item, index) => (
          <DraggableListItem
            key={item.state.key ?? item.state.name}
            draggableId={item.state.key ?? item.state.name}
            index={index}
          >
            <div className={styles.itemLabel}>
              <Text truncate>{renderItemLabel(item)}</Text>
            </div>
            <div className={styles.itemButtons}>
              <IconButton
                data-testid={selectors.components.PanelEditor.ElementEditPane.List.ListItem.editButton(
                  item.state.key ?? item.state.name
                )}
                tooltip={t('dashboard-scene.draggable-items-list.edit', 'Edit')}
                onClick={() => onEditItem(item)}
                name="pen"
                variant="secondary"
              />
              <IconButton
                data-testid={selectors.components.PanelEditor.ElementEditPane.List.ListItem.duplicateButton(
                  item.state.key ?? item.state.name
                )}
                tooltip={t('dashboard-scene.draggable-items-list.duplicate', 'Duplicate')}
                onClick={() => onDuplicateItem(item)}
                name="copy"
                variant="secondary"
              />
              <IconButton
                data-testid={selectors.components.PanelEditor.ElementEditPane.List.ListItem.deleteButton(
                  item.state.key ?? item.state.name
                )}
                tooltip={t('dashboard-scene.draggable-items-list.delete', 'Delete')}
                className={styles.destructiveButton}
                onClick={() => onDeleteItem(item)}
                name="trash-alt"
                variant="secondary"
              />
            </div>
          </DraggableListItem>
        ))}
      </ul>
    </DroppableCategory>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    list: css({
      listStyle: 'none',
      margin: 0,
      padding: 0,
    }),
    itemLabel: css({
      flexGrow: 1,
      overflow: 'hidden',
    }),
    itemButtons: css({
      visibility: 'hidden',
      display: 'flex',
      flexDirection: 'row',
      gap: theme.spacing(0.5),
      alignItems: 'center',
      justifyContent: 'flex-end',
      flexShrink: 0,
    }),
    destructiveButton: css({
      '&:hover, &:focus-within': {
        color: theme.colors.error.text,
      },
    }),
  };
}
