import { css } from '@emotion/css';
import { Draggable } from '@hello-pangea/dnd';
import { type ReactNode } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

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
        <li
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          className={styles.listItem}
        >
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
      minHeight: theme.spacing(4),
      paddingLeft: theme.spacing(2),
      paddingRight: theme.spacing(0.5),
      borderRadius: theme.shape.radius.default,
      color: theme.colors.text.primary,
      cursor: 'grab',
      '&:active': {
        cursor: 'grabbing',
      },
      '&:hover, &:focus-within': {
        color: theme.colors.text.maxContrast,
        backgroundColor: theme.colors.action.hover,
        boxShadow: `-${theme.spacing(1)} 0 0 0 ${theme.colors.action.hover}`,
        button: {
          visibility: 'visible',
        },
      },
    }),
  };
}
