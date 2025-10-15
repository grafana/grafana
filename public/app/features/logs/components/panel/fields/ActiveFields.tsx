import { css, cx } from '@emotion/css';
import { DragDropContext, Draggable, DraggableProvided, Droppable, DropResult } from '@hello-pangea/dnd';
import { useMemo } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { useStyles2 } from '@grafana/ui';

import { EmptyFields } from './EmptyFields';
import { Field } from './Field';
import { FieldWithStats } from './FieldSelector';

export function getLogsFieldsStyles(theme: GrafanaTheme2) {
  return {
    wrap: css({
      marginTop: theme.spacing(1),
      marginBottom: theme.spacing(1),
      display: 'flex',
      background: theme.colors.background.primary,
    }),
    dragging: css({
      background: theme.colors.background.secondary,
    }),
    columnWrapper: css({
      marginBottom: theme.spacing(1.5),
      // need some space or the outline of the checkbox is cut off
      paddingLeft: theme.spacing(0.5),
    }),
  };
}

interface Props {
  activeFields: string[];
  fields: FieldWithStats[];
  toggle: (key: string) => void;
  reorder: (columns: string[]) => void;
}

export const ActiveFields = ({ activeFields, fields, toggle, reorder }: Props): JSX.Element => {
  const styles = useStyles2(getLogsFieldsStyles);

  const onDragEnd = (result: DropResult) => {
    if (!result.destination) {
      return;
    }
    const newActiveFields = [...activeFields];
    const element = activeFields[result.source.index];

    newActiveFields.splice(result.source.index, 1);
    newActiveFields.splice(result.destination.index, 0, element);

    reorder(newActiveFields);
  };

  const active = useMemo(
    () =>
      activeFields.map((name) => fields.find((field) => field.name === name)).filter((field) => field !== undefined),
    [activeFields, fields]
  );

  if (fields.length) {
    return (
      <DragDropContext onDragEnd={onDragEnd}>
        <Droppable droppableId="order-fields" direction="vertical">
          {(provided) => (
            <div className={styles.columnWrapper} {...provided.droppableProps} ref={provided.innerRef}>
              {active.map((field, index) => (
                <Draggable draggableId={field.name} key={field.name} index={index}>
                  {(provided: DraggableProvided, snapshot) => (
                    <div
                      className={cx(styles.wrap, snapshot.isDragging ? styles.dragging : undefined)}
                      ref={provided.innerRef}
                      {...provided.draggableProps}
                      {...provided.dragHandleProps}
                      title={t(
                        'logs.field-selector.label-title',
                        `{{fieldName}} appears in {{percentage}}% of log lines`,
                        { fieldName: field.name, percentage: field.stats.percentOfLinesWithLabel }
                      )}
                    >
                      <Field active field={field} toggle={toggle} draggable={true} />
                    </div>
                  )}
                </Draggable>
              ))}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>
    );
  }

  return <EmptyFields />;
};
