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
        if (!def) {
          return `Operation ${op.id} not found`;
        }
        const title = def.renderer(op, def, '<expr>');
        const body = def.explainHandler ? def.explainHandler(op, def) : def.documentation ?? 'no docs';

        return <OperationExplainedBox stepNumber={index + stepNumber} key={index} title={title} markdown={body} />;
      })}
    </>
  );
}
