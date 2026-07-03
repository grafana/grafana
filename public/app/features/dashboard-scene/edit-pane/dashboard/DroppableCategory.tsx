import { css } from '@emotion/css';
import { Droppable } from '@hello-pangea/dnd';
import { type ReactNode } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { Counter, useStyles2 } from '@grafana/ui';
import { OptionsPaneCategory } from 'app/features/dashboard/components/PanelEditor/OptionsPaneCategory';

interface DroppableCategoryProps {
  droppableId: string;
  title: string;
  children: ReactNode;
  itemsCount?: number;
}

export function DroppableCategory({ droppableId, title, children, itemsCount }: DroppableCategoryProps) {
  const styles = useStyles2(getStyles);

  return (
    <Droppable droppableId={droppableId} direction="vertical">
      {(provided) => (
        <div ref={provided.innerRef} {...provided.droppableProps}>
          <OptionsPaneCategory
            id={droppableId}
            title={title}
            itemsCount={itemsCount}
            headerActionPlacement="left"
            compactIcons
            isNested
            renderTitle={() => (
              <span className={styles.title}>
                {title}
                {itemsCount !== undefined && <Counter value={itemsCount} />}
              </span>
            )}
          >
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
    title: css({
      display: 'inline-flex',
      alignItems: 'center',
      gap: theme.spacing(0.5),
      fontSize: theme.typography.bodySmall.fontSize,
    }),
  };
}
