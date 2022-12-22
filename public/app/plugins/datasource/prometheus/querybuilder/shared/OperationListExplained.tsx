import { Grammar } from 'prismjs';
import React from 'react';

import { OperationExplainedBox } from './OperationExplainedBox';
import { RawQuery } from './RawQuery';
import { QueryBuilderOperation, QueryWithOperations, VisualQueryModeller } from './types';

export interface Props<T extends QueryWithOperations> {
  query: T;
  queryModeller: VisualQueryModeller;
  explainMode?: boolean;
  stepNumber: number;
  lang: {
    grammar: Grammar;
    name: string;
  };
  onMouseEnter?: (op: QueryBuilderOperation, index: number) => void;
  onMouseLeave?: (op: QueryBuilderOperation, index: number) => void;
}

export function OperationListExplained<T extends QueryWithOperations>({
  query,
  queryModeller,
  stepNumber,
  lang,
  onMouseEnter,
  onMouseLeave,
}: Props<T>) {
  return (
    <>
      {query.operations.map((op, index) => {
        const def = queryModeller.getOperationDef(op.id);
        if (!def) {
          return `Operation ${op.id} not found`;
        }
        const title = def.renderer(op, def, '<expr>');
        const body = def.explainHandler ? def.explainHandler(op, def) : def.documentation ?? 'no docs';

        return (
          <div
            key={index}
            onMouseEnter={() => onMouseEnter?.(op, index)}
            onMouseLeave={() => onMouseLeave?.(op, index)}
          >
            <OperationExplainedBox
              stepNumber={index + stepNumber}
              title={<RawQuery query={title} lang={lang} />}
              markdown={body}
            />
          </div>
        );
      })}
    </>
  );
}
