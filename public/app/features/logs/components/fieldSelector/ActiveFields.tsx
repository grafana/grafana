import { css, cx } from '@emotion/css';
import { DragDropContext, Draggable, DraggableProvided, Droppable, DropResult } from '@hello-pangea/dnd';
import { useCallback, useMemo } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { useStyles2 } from '@grafana/ui';

import { Field } from './Field';
import { FieldWithStats } from './FieldSelector';

interface Props {
  activeFields: string[];
  clear(): void;
  fields: FieldWithStats[];
  reorder: (columns: string[]) => void;
  suggestedFields: FieldWithStats[];
  toggle: (key: string) => void;
}

export const ActiveFields = ({ activeFields, clear, fields, reorder, suggestedFields, toggle }: Props) => {
  const styles = useStyles2(getLogsFieldsStyles);

  const active = useMemo(
    () => [
      ...activeFields
        .map(
          (name) => fields.find((field) => field.name === name) ?? suggestedFields.find((field) => field.name === name)
        )
        .filter((field) => field !== undefined),
    ],
    [activeFields, fields, suggestedFields]
  );

  const onDragEnd = useCallback(
    (result: DropResult) => {
      if (!result.destination) {
        return;
      }

      // Get the field names from the active array (what's actually rendered)
      // The indices in result are based on the active array, not activeFields
      const sourceFieldName = active[result.source.index]?.name;
      if (!sourceFieldName) {
        return;
      }

      // Create a new array with the reordered fields
      const newActiveFields = [...activeFields];

      // Find the actual index of the source field in activeFields
      const sourceIndexInActiveFields = newActiveFields.indexOf(sourceFieldName);
      if (sourceIndexInActiveFields === -1) {
        return;
      }

      // Remove the source field from its current position
      const [movedField] = newActiveFields.splice(sourceIndexInActiveFields, 1);

      // Find where to insert it based on the destination in the active array
      const destFieldName = active[result.destination.index]?.name;
      if (destFieldName) {
        // Find the destination field in activeFields
        const destIndexInActiveFields = newActiveFields.indexOf(destFieldName);
        if (destIndexInActiveFields !== -1) {
          // If dragging down, insert after; if dragging up, insert before
          const insertIndex =
            result.source.index < result.destination.index ? destIndexInActiveFields + 1 : destIndexInActiveFields;
          newActiveFields.splice(insertIndex, 0, movedField);
        } else {
          // Destination field not found in activeFields (shouldn't happen), append
          newActiveFields.push(movedField);
        }
      } else {
        // No destination field, append
        newActiveFields.push(movedField);
      }

      reorder(newActiveFields);
    },
    [activeFields, active, reorder]
  );

  const suggested = useMemo(
    () => suggestedFields.filter((suggestedField) => !activeFields.includes(suggestedField.name)),
    [activeFields, suggestedFields]
  );

  if (active.length || suggested.length) {
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
                  <Draggable
                    draggableId={field.name}
                    key={field.name}
                    index={index}
                    isDragDisabled={!activeFields.includes(field.name)}
                  >
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
                        <Field
                          active={activeFields.includes(field.name)}
                          field={field}
                          toggle={toggle}
                          draggable={activeFields.includes(field.name)}
                        />
                      </div>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>
        {suggested.length > 0 && (
          <>
            <div className={styles.columnSubHeader}>
              <Trans i18nKey="explore.logs-table-multi-select.suggested-fields">Suggested</Trans>
            </div>
            <div className={styles.columnWrapper}>
              {suggested.map((field) => (
                <div className={styles.wrap} key={field.name}>
                  <Field field={field} toggle={toggle} />
                </div>
              ))}
            </div>
          </>
        )}
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
    columnSubHeader: css({
      padding: theme.spacing(0, 0, 0.75, 0.5),
      color: theme.colors.text.secondary,
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
