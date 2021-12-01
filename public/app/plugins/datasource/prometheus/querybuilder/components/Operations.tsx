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
    segments.push(<OperationEditor index={index} operation={query.operations[index]} onChange={onOperationChange} />);
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

  segments.push(<ButtonCascader icon="plus" options={addOptions} />);

  return <>{segments}</>;
}
