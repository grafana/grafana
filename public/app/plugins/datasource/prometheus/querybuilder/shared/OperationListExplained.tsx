import React from 'react';
import { OperationExplainedBox } from './OperationExplainedBox';
import { QueryWithOperations, VisualQueryModeller } from './types';

export interface Props<T extends QueryWithOperations> {
  query: T;
  queryModeller: VisualQueryModeller;
  explainMode?: boolean;
  stepNumber: number;
}

export function OperationListExplained<T extends QueryWithOperations>({ query, queryModeller, stepNumber }: Props<T>) {
  return (
    <>
      {query.operations.map((op, index) => {
        const def = queryModeller.getOperationDef(op.id);
        const title = def.renderer(op, def, '<query>');

        return (
          <OperationExplainedBox stepNumber={index + stepNumber} key={index} title={title}>
            {def.documentation ?? 'no docs'}
          </OperationExplainedBox>
        );
      })}
    </>
  );
}
