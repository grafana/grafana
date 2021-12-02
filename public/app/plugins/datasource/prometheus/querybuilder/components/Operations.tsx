import { ButtonCascader, CascaderOption } from '@grafana/ui';
import React from 'react';
import { visualQueryEngine } from '../engine';
import { operationTopLevelCategories, PromVisualQuery, PromVisualQueryOperation } from '../types';
import { OperationEditor } from './OperationEditor';

export interface Props {
  query: PromVisualQuery;
  onChange: (query: PromVisualQuery) => void;
}

export function Operations({ query, onChange }: Props) {
  const onOperationChange = (index: number, update: PromVisualQueryOperation) => {
    const operations = [...query.operations];
    operations.splice(index, 1, update);
    onChange({ ...query, operations });
  };

  let segments: React.ReactNode[] = [];

  for (let index = 0; index < query.operations.length; index++) {
    segments.push(
      <OperationEditor
        key={index.toString()}
        index={index}
        operation={query.operations[index]}
        onChange={onOperationChange}
      />
    );
  }

  const addOptions: CascaderOption[] = operationTopLevelCategories.map((category) => {
    return {
      value: category,
      label: category,
      children: visualQueryEngine.getOperationsForCategory(category).map((operation) => ({
        value: operation.type,
        label: operation.type,
        isLeaf: true,
      })),
    };
  });

  const onAddOperation = (value: string[]) => {
    const operation = visualQueryEngine.getOperationDef(value[1]);
    const newOperation: PromVisualQueryOperation = {
      type: operation.type,
      params: operation.defaultParams,
    };

    onChange({
      ...query,
      operations: [...query.operations, newOperation],
    });
  };

  segments.push(<ButtonCascader key="cascader" icon="plus" options={addOptions} onChange={onAddOperation} />);

  return <>{segments}</>;
}
