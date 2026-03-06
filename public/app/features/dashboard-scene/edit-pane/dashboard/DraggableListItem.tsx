import { css } from '@emotion/css';
import { Draggable } from '@hello-pangea/dnd';
import { ReactNode } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { useStyles2, Tooltip, Icon } from '@grafana/ui';

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
          <div {...provided.dragHandleProps}>
            <Tooltip content={t('dashboard-scene.draggable-item.drag-to-reorder', 'Drag to reorder')} placement="top">
              <Icon name="draggabledots" size="md" className={styles.dragHandle} />
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
      display: 'flex',
      alignItems: 'center',
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
