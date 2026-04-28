import { css } from '@emotion/css';
import { type ReactNode } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { Trans } from '@grafana/i18n';
import { Button, Text, useStyles2 } from '@grafana/ui';

import { DraggableListItem } from './DraggableListItem';
import { DroppableCategory } from './DroppableCategory';

interface DraggableListProps<T extends { state: { key?: string; name: string } }> {
  items: T[];
  droppableId: string;
  title: string;
  onClickItem: (item: T) => void;
  renderItemLabel: (item: T) => NonNullable<ReactNode>;
}

export function DraggableList<T extends { state: { key?: string; name: string } }>({
  items,
  droppableId,
  title,
  onClickItem,
  renderItemLabel,
}: DraggableListProps<T>) {
  const styles = useStyles2(getStyles);

  return (
    <DroppableCategory droppableId={droppableId} title={title}>
      <ul className={styles.list} data-testid={droppableId}>
        {items.map((item, index) => (
          <DraggableListItem
            key={item.state.key ?? item.state.name}
            draggableId={item.state.key ?? item.state.name}
            index={index}
          >
            <div
              className={styles.itemButton}
              role="button"
              tabIndex={0}
              onClick={() => onClickItem(item)}
              onKeyDown={(event: React.KeyboardEvent) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  onClickItem(item);
                }
              }}
            >
              <Text truncate>{renderItemLabel(item)}</Text>
              <Button variant="primary" size="sm" fill="outline">
                <Trans i18nKey="dashboard-scene.draggable-items-list.select">Select</Trans>
              </Button>
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
    itemButton: css({
      display: 'flex',
      flexDirection: 'row',
      gap: theme.spacing(0.5),
      alignItems: 'center',
      justifyContent: 'space-between',
      width: '100%',
      cursor: 'pointer',
      [theme.transitions.handleMotion('no-preference', 'reduce')]: {
        transition: theme.transitions.create(['color'], {
          duration: theme.transitions.duration.short,
        }),
      },
      button: {
        visibility: 'hidden',
      },
      '&:hover': {
        color: theme.colors.text.link,
        button: {
          visibility: 'visible',
        },
      },
    }),
  };
}
