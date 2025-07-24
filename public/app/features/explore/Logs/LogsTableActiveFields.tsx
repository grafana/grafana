import { css, cx } from '@emotion/css';
import { DragDropContext, Draggable, DraggableProvided, Droppable, DropResult } from '@hello-pangea/dnd';

import { GrafanaTheme2 } from '@grafana/data';
import { useTheme2 } from '@grafana/ui';

import { LogsTableEmptyFields } from './LogsTableEmptyFields';
import { LogsTableNavField } from './LogsTableNavField';
import { FieldNameMeta } from './LogsTableWrap';

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

function sortLabels(labels: Record<string, FieldNameMeta>) {
  return (a: string, b: string) => {
    const la = labels[a];
    const lb = labels[b];

    // Sort by index
    if (la.index != null && lb.index != null) {
      return la.index - lb.index;
    }

    // otherwise do not sort
    return 0;
  };
}

export const LogsTableActiveFields = (props: {
  labels: Record<string, FieldNameMeta>;
  valueFilter: (value: string) => boolean;
  toggleColumn: (columnName: string) => void;
  reorderColumn: (sourceIndex: number, destinationIndex: number) => void;
  id: string;
}): JSX.Element => {
  const { reorderColumn, labels, valueFilter, toggleColumn } = props;
  const theme = useTheme2();
  const styles = getLogsFieldsStyles(theme);
  const labelKeys = Object.keys(labels).filter((labelName) => valueFilter(labelName));

  const onDragEnd = (result: DropResult) => {
    if (!result.destination) {
      return;
    }
    reorderColumn(result.source.index, result.destination.index);
  };

  const renderTitle = (labelName: string) => {
    const label = labels[labelName];
    if (label) {
      return `${labelName} appears in ${label?.percentOfLinesWithLabel}% of log lines`;
    }

    return undefined;
  };

  if (labelKeys.length) {
    return (
      <DragDropContext onDragEnd={onDragEnd}>
        <Droppable droppableId="order-fields" direction="vertical">
          {(provided) => (
            <div className={styles.columnWrapper} {...provided.droppableProps} ref={provided.innerRef}>
              {labelKeys.sort(sortLabels(labels)).map((labelName, index) => (
                <Draggable draggableId={labelName} key={labelName} index={index}>
                  {(provided: DraggableProvided, snapshot) => (
                    <div
                      className={cx(styles.wrap, snapshot.isDragging ? styles.dragging : undefined)}
                      ref={provided.innerRef}
                      {...provided.draggableProps}
                      {...provided.dragHandleProps}
                      title={renderTitle(labelName)}
                    >
                      <LogsTableNavField
                        label={labelName}
                        onChange={() => toggleColumn(labelName)}
                        labels={labels}
                        draggable={true}
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
    );
  }

  return <LogsTableEmptyFields />;
};
