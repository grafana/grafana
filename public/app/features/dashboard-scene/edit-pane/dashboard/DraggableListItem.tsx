import { css } from '@emotion/css';
import { Draggable } from '@hello-pangea/dnd';
import { type ReactNode } from 'react';

import type { GrafanaTheme2 } from '@grafana/data/themes';
import { t } from '@grafana/i18n';
import { Tooltip } from '@grafana/ui';
import { Icon } from '@grafana/ui/components/icons';
import { useStyles2 } from '@grafana/ui/themes';

interface DraggableListItemProps {
  draggableId: string;
  index: number;
  children: ReactNode;
}

export function DraggableListItem({ draggableId, index, children }: DraggableListItemProps) {
  const styles = useStyles2(getStyles);

  return (
    <Draggable draggableId={draggableId} index={index}>
      {(provided) => (
        <li ref={provided.innerRef} {...provided.draggableProps} className={styles.listItem}>
          <div {...provided.dragHandleProps} className={styles.dragHandle}>
            <Tooltip content={t('dashboard-scene.draggable-item.drag-to-reorder', 'Drag to reorder')} placement="top">
              <Icon name="draggabledots" size="md" />
            </Tooltip>
          </div>
          {children}
        </li>
      )}
    </Draggable>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    listItem: css({
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing(0.5),
      padding: theme.spacing(0.25),
    }),
    dragHandle: css({
      alignSelf: 'stretch',
      cursor: 'grab',
      color: theme.colors.text.secondary,
      '&:hover': {
        color: theme.colors.text.primary,
      },
      '&:active': {
        cursor: 'grabbing',
      },
    }),
  };
}
