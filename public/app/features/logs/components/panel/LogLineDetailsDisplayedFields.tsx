import { css } from '@emotion/css';
import { DragDropContext, Draggable, Droppable, DropResult } from '@hello-pangea/dnd';
import { useCallback } from 'react';

import { Card, useStyles2 } from '@grafana/ui';

import { useLogListContext } from './LogListContext';
import { GrafanaTheme2 } from '@grafana/data';

interface Props {}

export const LogLineDetailsDisplayedFields = () => {
  const { displayedFields } = useLogListContext();

  const onDragEnd = useCallback((result: DropResult) => {
    if (result.destination == null) {
      return;
    }

    console.log(result);
  }, []);

  return (
    <div>
      <DragDropContext onDragEnd={onDragEnd}>
        <Droppable ignoreContainerClipping={true} droppableId="displayed-fields" direction="vertical">
          {(provided) => {
            return (
              <>
                <div ref={provided.innerRef} {...provided.droppableProps}>
                  {displayedFields.map((field, index) => (
                    <DraggableDisplayedField key={field} field={field} index={index} />
                  ))}
                </div>
                {provided.placeholder}
              </>
            );
          }}
        </Droppable>
      </DragDropContext>
    </div>
  );
};

interface DraggableDisplayedFieldProps {
  field: string;
  index: number;
}

const DraggableDisplayedField = ({ field, index }: DraggableDisplayedFieldProps) => {
  const styles = useStyles2(getStyles);
  return (
    <Draggable draggableId={`field-${index}`} index={index}>
      {(provided) => (
        <div ref={provided.innerRef} {...provided.draggableProps} {...provided.dragHandleProps}>
          <Card className={styles.fieldCard}>{field}</Card>
        </div>
      )}
    </Draggable>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  fieldCard: css({
    padding: theme.spacing(1),
  }),
});
