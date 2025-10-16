import { css, cx } from '@emotion/css';
import { DragDropContext, Draggable, DraggableProvided, Droppable, DropResult } from '@hello-pangea/dnd';
import { useMemo } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { useStyles2 } from '@grafana/ui';

import { Field } from './Field';
import { FieldWithStats } from './FieldSelector';

interface Props {
  activeFields: string[];
  clear(): void;
  fields: FieldWithStats[];
  toggle: (key: string) => void;
  reorder: (columns: string[]) => void;
}

export const ActiveFields = ({ activeFields, clear, fields, toggle, reorder }: Props) => {
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

  if (active.length) {
    return (
      <>
        <div className={styles.columnHeader}>
          <Trans i18nKey="explore.logs-table-multi-select.selected-fields">Selected fields</Trans>
          <button onClick={clear} className={styles.columnHeaderButton}>
            <Trans i18nKey="explore.logs-table-multi-select.reset">Reset</Trans>
          </button>
        </div>
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
      </>
    );
  }

  return null;
};

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
    columnHeader: css({
      display: 'flex',
      justifyContent: 'space-between',
      fontSize: theme.typography.h6.fontSize,
      background: theme.colors.background.secondary,
      position: 'sticky',
      top: 0,
      left: 0,
      paddingTop: theme.spacing(0.75),
      paddingRight: theme.spacing(0.75),
      paddingBottom: theme.spacing(0.75),
      paddingLeft: theme.spacing(1.5),
      zIndex: 3,
      marginBottom: theme.spacing(2),
    }),
    columnHeaderButton: css({
      appearance: 'none',
      background: 'none',
      border: 'none',
      fontSize: theme.typography.pxToRem(11),
    }),
    columnWrapper: css({
      marginBottom: theme.spacing(1.5),
      // need some space or the outline of the checkbox is cut off
      paddingLeft: theme.spacing(0.5),
    }),
  };
}
