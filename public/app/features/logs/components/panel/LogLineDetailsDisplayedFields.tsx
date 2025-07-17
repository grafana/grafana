import { css } from '@emotion/css';
import { DragDropContext, Draggable, DraggableProvided, Droppable, DropResult } from '@hello-pangea/dnd';
import { useCallback } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Card, IconButton, useStyles2 } from '@grafana/ui';

import { LOG_LINE_BODY_FIELD_NAME } from '../LogDetailsBody';

import { LogLineDetailsMode } from './LogLineDetails';
import { useLogListContext } from './LogListContext';

export const LogLineDetailsDisplayedFields = () => {
  const { displayedFields, setDisplayedFields } = useLogListContext();

  const reorganizeDisplayedFields = useCallback(
    (srcIndex: number, destIndex: number) => {
      const newDisplayedFields = [...displayedFields];
      const element = displayedFields[srcIndex];

      newDisplayedFields.splice(srcIndex, 1);
      newDisplayedFields.splice(destIndex, 0, element);

      setDisplayedFields?.(newDisplayedFields);
    },
    [displayedFields, setDisplayedFields]
  );

  const onDragEnd = useCallback(
    (result: DropResult) => {
      if (result.destination == null) {
        return;
      }
      reorganizeDisplayedFields(result.source.index, result.destination.index);
    },
    [reorganizeDisplayedFields]
  );

  return (
    <div>
      <DragDropContext onDragEnd={onDragEnd}>
        <Droppable droppableId="displayed-fields" direction="vertical">
          {(provided) => {
            return (
              <div ref={provided.innerRef} {...provided.droppableProps}>
                {displayedFields.map((field, index) => (
                  <DraggableDisplayedField
                    key={field}
                    field={field}
                    index={index}
                    moveField={reorganizeDisplayedFields}
                  />
                ))}
                {provided.placeholder}
              </div>
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
  moveField: (srcIndex: number, destIndex: number) => void;
}

const DraggableDisplayedField = ({ field, index, moveField }: DraggableDisplayedFieldProps) => {
  return (
    <Draggable draggableId={field} index={index}>
      {(provided) => (
        <DisplayedField key={field} field={field} index={index} moveField={moveField} provided={provided} />
      )}
    </Draggable>
  );
};

const DisplayedField = ({
  field,
  index,
  moveField,
  provided,
}: DraggableDisplayedFieldProps & { provided: DraggableProvided }) => {
  const { detailsMode, displayedFields, onClickHideField } = useLogListContext();
  const styles = useStyles2(getStyles, detailsMode);
  const nextIndex = index === displayedFields.length - 1 ? 0 : index + 1;
  const prevIndex = index === 0 ? displayedFields.length - 1 : index - 1;
  return (
    <div ref={provided.innerRef} {...provided.draggableProps} {...provided.dragHandleProps}>
      <Card noMargin className={styles.fieldCard}>
        <div className={styles.fieldWrapper}>
          <div className={styles.field}>
            {field === LOG_LINE_BODY_FIELD_NAME ? t('logs.log-line-details.log-line-field', 'Log line') : field}
          </div>
          {displayedFields.length > 1 && (
            <>
              <IconButton
                name="arrow-down"
                onClick={() => moveField(index, nextIndex)}
                tooltip={t('logs.log-line-details.move-displayed-field-down', 'Move down')}
              />
              <IconButton
                name="arrow-up"
                onClick={() => moveField(index, prevIndex)}
                tooltip={t('logs.log-line-details.move-displayed-field-up', 'Move up')}
              />
            </>
          )}
          {onClickHideField && (
            <IconButton
              name="times"
              onClick={() => onClickHideField(field)}
              tooltip={t('logs.log-line-details.remove-displayed-field', 'Remove field')}
            />
          )}
        </div>
      </Card>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2, detailsMode: LogLineDetailsMode) => ({
  fieldCard: css({
    display: 'block',
    padding: theme.spacing(1),
    marginBottom: theme.spacing(1),
    width: detailsMode === 'inline' ? '30vw' : undefined,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    wordBreak: 'break-word',
  }),
  fieldWrapper: css({
    cursor: 'move',
    display: 'flex',
    gap: theme.spacing(0.5),
    justifyContent: 'space-evenly',
  }),
  field: css({
    flex: 1,
  }),
});
