import { css, cx } from '@emotion/css';
import React, { useCallback } from 'react';
import { DragDropContext, Draggable, DraggableProvided, Droppable, DropResult } from 'react-beautiful-dnd';

import { GrafanaTheme2 } from '@grafana/data/src';
import { Checkbox, useTheme2 } from '@grafana/ui/src';

import { fieldNameMeta } from './LogsTableWrap';

function getStyles(theme: GrafanaTheme2) {
  return {
    labelCount: css({
      marginLeft: theme.spacing(0.5),
      marginRight: theme.spacing(0.5),
      appearance: 'none',
      background: 'none',
      border: 'none',
      fontSize: theme.typography.pxToRem(11),
    }),
    wrap: css({
      display: 'flex',
      alignItems: 'center',
      marginTop: theme.spacing(1),
      marginBottom: theme.spacing(1),
      justifyContent: 'space-between',
    }),
    // Making the checkbox sticky and label scrollable for labels that are wider then the container
    // However, the checkbox component does not support this, so we need to do some css hackery for now until the API of that component is updated.
    checkboxLabel: css({
      '> :first-child': {
        position: 'sticky',
        left: 0,
        bottom: 0,
        top: 0,
      },
      '> span': {
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        display: 'block',
        maxWidth: '100%',
      },
    }),
    columnWrapper: css({
      marginBottom: theme.spacing(1.5),
      // need some space or the outline of the checkbox is cut off
      paddingLeft: theme.spacing(0.5),
    }),
    empty: css({
      marginBottom: theme.spacing(2),
      marginLeft: theme.spacing(1.75),
      fontSize: theme.typography.fontSize,
    }),
  };
}

const collator = new Intl.Collator(undefined, { sensitivity: 'base' });

function sortLabels(labels: Record<string, fieldNameMeta>) {
  return (a: string, b: string) => {
    const la = labels[a];
    const lb = labels[b];

    if (la.index != null && lb.index != null) {
      return la.index - lb.index;
    }

    if (la != null && lb != null) {
      return (
        Number(lb.type === 'TIME_FIELD') - Number(la.type === 'TIME_FIELD') ||
        Number(lb.type === 'BODY_FIELD') - Number(la.type === 'BODY_FIELD') ||
        collator.compare(a, b)
      );
    }
    // otherwise do not sort
    return 0;
  };
}

export const LogsTableNavColumn = (props: {
  labels: Record<string, fieldNameMeta>;
  valueFilter: (value: string) => boolean;
  toggleColumn: (columnName: string) => void;
  id: string;
  reorderColumn: (oldIndex: number, newIndex: number) => void;
}): JSX.Element => {
  const { reorderColumn } = props;

  const onDragEnd = useCallback(
    (result: DropResult) => {
      if (!result.destination) {
        return;
      }
      reorderColumn(result.source.index, result.destination.index);
    },
    [reorderColumn]
  );

  const { labels, valueFilter, toggleColumn, id } = props;
  const theme = useTheme2();
  const styles = getStyles(theme);
  const labelKeys = Object.keys(labels).filter((labelName) => valueFilter(labelName));
  if (labelKeys.length) {
    return (
      <DragDropContext onDragEnd={onDragEnd}>
        <Droppable droppableId={id} direction="vertical">
          {(provided) => (
            <div className={styles.columnWrapper} {...provided.droppableProps} ref={provided.innerRef}>
              {provided.placeholder}
              {labelKeys.sort(sortLabels(labels)).map((labelName, index) => (
                <Draggable draggableId={labelName} key={labelName} index={index}>
                  {(provided: DraggableProvided) => (
                    <div
                      className={cx(styles.wrap)}
                      ref={provided.innerRef}
                      {...provided.draggableProps}
                      {...provided.dragHandleProps}
                      title={`${labelName} appears in ${labels[labelName]?.percentOfLinesWithLabel}% of log lines`}
                    >
                      <Checkbox
                        className={styles.checkboxLabel}
                        label={labelName}
                        onChange={() => toggleColumn(labelName)}
                        checked={labels[labelName]?.active ?? false}
                      />
                      <button className={styles.labelCount} onClick={() => toggleColumn(labelName)}>
                        {labels[labelName]?.percentOfLinesWithLabel}%
                      </button>
                    </div>
                  )}
                </Draggable>
              ))}
            </div>
          )}
        </Droppable>
      </DragDropContext>
    );
  }

  return <div className={styles.empty}>No fields</div>;
};
