import { css } from '@emotion/css';
import { type ReactNode } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { t } from '@grafana/i18n';
import { IconButton, Text, useStyles2 } from '@grafana/ui';

import { DraggableListItem } from './DraggableListItem';
import { DroppableCategory } from './DroppableCategory';

interface DraggableListProps<T extends { state: { key?: string; name: string } }> {
  items: T[];
  droppableId: string;
  title: string;
  onEditItem: (item: T) => void;
  onDuplicateItem: (item: T) => void;
  onDeleteItem: (item: T) => void;
  renderItemLabel: (item: T) => NonNullable<ReactNode>;
  /** Rows shown in this category that cannot be reordered, duplicated, or deleted. */
  leading?: ReactNode;
  itemsCount?: number;
  /** Drop the extra label inset so these rows line up with read-only rows in the same list. */
  flushLabel?: boolean;
}

export function DraggableList<T extends { state: { key?: string; name: string } }>({
  items,
  droppableId,
  title,
  onEditItem,
  onDuplicateItem,
  onDeleteItem,
  renderItemLabel,
  leading,
  itemsCount,
  flushLabel = false,
}: DraggableListProps<T>) {
  const styles = useStyles2(getStyles, flushLabel);

  return (
    <DroppableCategory droppableId={droppableId} title={title} itemsCount={itemsCount ?? items.length}>
      <ul className={styles.list} data-testid={droppableId}>
        {leading}
        {items.map((item, index) => (
          <DraggableListItem
            key={item.state.key ?? item.state.name}
            draggableId={item.state.key ?? item.state.name}
            index={index}
            actions={
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
            }
          >
            <div className={styles.itemLabel}>
              <Text variant="body" truncate>
                {renderItemLabel(item)}
              </Text>
            </div>
          </DraggableListItem>
        ))}
      </ul>
    </DroppableCategory>
  );
}

function getStyles(theme: GrafanaTheme2, flushLabel: boolean) {
  return {
    list: css({
      listStyle: 'none',
      margin: 0,
      padding: 0,
    }),
    itemLabel: css({
      flexGrow: 1,
      overflow: 'hidden',
      paddingLeft: flushLabel ? undefined : theme.spacing(1),
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
