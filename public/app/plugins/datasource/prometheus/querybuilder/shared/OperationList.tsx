import { css } from '@emotion/css';
import React, { useState } from 'react';
import { DragDropContext, Droppable, DropResult } from 'react-beautiful-dnd';
import { useMountedState, usePrevious } from 'react-use';

import { DataSourceApi, GrafanaTheme2 } from '@grafana/data';
import { Stack } from '@grafana/experimental';
import { Button, Cascader, CascaderOption, useStyles2 } from '@grafana/ui';

import { OperationEditor } from './OperationEditor';
import { QueryBuilderOperation, QueryWithOperations, VisualQueryModeller } from './types';

export interface Props<T extends QueryWithOperations> {
  query: T;
  datasource: DataSourceApi;
  onChange: (query: T) => void;
  onRunQuery: () => void;
  queryModeller: VisualQueryModeller;
  explainMode?: boolean;
  highlightedOp?: QueryBuilderOperation;
}

export function OperationList<T extends QueryWithOperations>({
  query,
  datasource,
  queryModeller,
  onChange,
  onRunQuery,
  highlightedOp,
}: Props<T>) {
  const styles = useStyles2(getStyles);
  const { operations } = query;

  const opsToHighlight = useOperationsHighlight(operations);

  const [cascaderOpen, setCascaderOpen] = useState(false);

  const onOperationChange = (index: number, update: QueryBuilderOperation) => {
    const updatedList = [...operations];
    updatedList.splice(index, 1, update);
    onChange({ ...query, operations: updatedList });
  };

  const onRemove = (index: number) => {
    const updatedList = [...operations.slice(0, index), ...operations.slice(index + 1)];
    onChange({ ...query, operations: updatedList });
  };

  const addOptions: CascaderOption[] = queryModeller.getCategories().map((category) => {
    return {
      value: category,
      label: category,
      items: queryModeller.getOperationsForCategory(category).map((operation) => ({
        value: operation.id,
        label: operation.name,
        isLeaf: true,
      })),
    };
  });

  const onAddOperation = (value: string) => {
    const operationDef = queryModeller.getOperationDef(value);
    if (!operationDef) {
      return;
    }
    onChange(operationDef.addOperationHandler(operationDef, query, queryModeller));
    setCascaderOpen(false);
  };

  const onDragEnd = (result: DropResult) => {
    if (!result.destination) {
      return;
    }

    const updatedList = [...operations];
    const element = updatedList[result.source.index];
    updatedList.splice(result.source.index, 1);
    updatedList.splice(result.destination.index, 0, element);
    onChange({ ...query, operations: updatedList });
  };

  const onCascaderBlur = () => {
    setCascaderOpen(false);
  };

  return (
    <Stack gap={1} direction="column">
      <Stack gap={1}>
        {operations.length > 0 && (
          <DragDropContext onDragEnd={onDragEnd}>
            <Droppable droppableId="sortable-field-mappings" direction="horizontal">
              {(provided) => (
                <div className={styles.operationList} ref={provided.innerRef} {...provided.droppableProps}>
                  {operations.map((op, index) => {
                    return (
                      <OperationEditor
                        key={op.id + JSON.stringify(op.params) + index}
                        queryModeller={queryModeller}
                        index={index}
                        operation={op}
                        query={query}
                        datasource={datasource}
                        onChange={onOperationChange}
                        onRemove={onRemove}
                        onRunQuery={onRunQuery}
                        flash={opsToHighlight[index]}
                        highlight={highlightedOp === op}
                      />
                    );
                  })}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>
        )}
        <div className={styles.addButton}>
          {cascaderOpen ? (
            <Cascader
              options={addOptions}
              onSelect={onAddOperation}
              onBlur={onCascaderBlur}
              autoFocus={true}
              alwaysOpen={true}
              hideActiveLevelLabel={true}
              placeholder={'Search'}
            />
          ) : (
            <Button icon={'plus'} variant={'secondary'} onClick={() => setCascaderOpen(true)} title={'Add operation'}>
              Operations
            </Button>
          )}
        </div>
      </Stack>
    </Stack>
  );
}

/**
 * Returns indexes of operations that should be highlighted. We check the diff of operations added but at the same time
 * we want to highlight operations only after the initial render, so we check for mounted state and calculate the diff
 * only after.
 * @param operations
 */
function useOperationsHighlight(operations: QueryBuilderOperation[]) {
  const isMounted = useMountedState();
  const prevOperations = usePrevious(operations);

  if (!isMounted()) {
    return operations.map(() => false);
  }

  if (!prevOperations) {
    return operations.map(() => true);
  }

  let newOps: boolean[] = [];

  if (prevOperations.length - 1 === operations.length && operations.every((op) => prevOperations.includes(op))) {
    // In case we remove one op and does not change any ops then don't highlight anything.
    return operations.map(() => false);
  }
  if (prevOperations.length + 1 === operations.length && prevOperations.every((op) => operations.includes(op))) {
    // If we add a single op just find it and highlight just that.
    const newOp = operations.find((op) => !prevOperations.includes(op));
    newOps = operations.map((op) => {
      return op === newOp;
    });
  } else {
    // Default diff of all ops.
    newOps = operations.map((op, index) => {
      return !isSameOp(op.id, prevOperations[index]?.id);
    });
  }
  return newOps;
}

function isSameOp(op1?: string, op2?: string) {
  return op1 === op2 || `__${op1}_by` === op2 || op1 === `__${op2}_by`;
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    heading: css({
      label: 'heading',
      fontSize: 12,
      fontWeight: theme.typography.fontWeightMedium,
      marginBottom: 0,
    }),
    operationList: css({
      label: 'operationList',
      display: 'flex',
      flexWrap: 'wrap',
      gap: theme.spacing(2),
    }),
    addButton: css({
      label: 'addButton',
      width: 126,
      paddingBottom: theme.spacing(1),
    }),
  };
};
