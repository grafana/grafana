import { css } from '@emotion/css';
import { Droppable } from '@hello-pangea/dnd';
import { type ReactNode } from 'react';

import type { GrafanaTheme2 } from '@grafana/data/themes';
import { useStyles2 } from '@grafana/ui/themes';
import { OptionsPaneCategory } from 'app/features/dashboard/components/PanelEditor/OptionsPaneCategory';

interface DroppableCategoryProps {
  droppableId: string;
  title: string;
  children: ReactNode;
}

export function DroppableCategory({ droppableId, title, children }: DroppableCategoryProps) {
  const styles = useStyles2(getStyles);

  return (
    <Droppable droppableId={droppableId} direction="vertical">
      {(provided) => (
        <div ref={provided.innerRef} {...provided.droppableProps}>
          <OptionsPaneCategory id={droppableId} className={styles.category} title={title}>
            {children}
            {provided.placeholder}
          </OptionsPaneCategory>
        </div>
      )}
    </Droppable>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    category: css({
      '& :has(> ul)': {
        padding: theme.spacing(0, 2, 1, 2),
      },
    }),
  };
}
