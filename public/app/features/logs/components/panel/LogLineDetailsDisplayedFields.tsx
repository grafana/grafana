import { css } from '@emotion/css';
import { DragDropContext, Draggable, Droppable, DropResult } from '@hello-pangea/dnd';
import { useCallback } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Card, IconButton, useStyles2 } from '@grafana/ui';

import { LOG_LINE_BODY_FIELD_NAME } from '../LogDetailsBody';

import { useLogListContext } from './LogListContext';

export const LogLineDetailsDisplayedFields = () => {
  const { displayedFields, setDisplayedFields } = useLogListContext();

  const onDragEnd = useCallback(
    (result: DropResult) => {
      if (result.destination == null) {
        return;
      }

      const newDisplayedFields = [...displayedFields];
      const element = displayedFields[result.source.index];
      newDisplayedFields.splice(result.source.index, 1);
      newDisplayedFields.splice(result.destination.index, 0, element);

      setDisplayedFields?.(newDisplayedFields);
    },
    [displayedFields, setDisplayedFields]
  );

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
  const { onClickHideField } = useLogListContext();
  const styles = useStyles2(getStyles);
  return (
    <Draggable draggableId={field} index={index}>
      {(provided) => (
        <div ref={provided.innerRef} {...provided.draggableProps} {...provided.dragHandleProps}>
          <Card className={styles.fieldCard}>
            <div>
              {field === LOG_LINE_BODY_FIELD_NAME ? t('logs.log-line-details.log-line-field', 'Log line') : field}
            </div>
            {onClickHideField && (
              <IconButton
                name="times"
                onClick={() => onClickHideField(field)}
                tooltip={t('logs.log-line-details.remove-displayed-field', 'Remove field')}
              />
            )}
          </Card>
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
