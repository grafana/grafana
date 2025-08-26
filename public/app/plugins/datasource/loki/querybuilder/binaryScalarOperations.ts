import {
  QueryBuilderOperation,
  QueryBuilderOperationDefinition,
  QueryBuilderOperationParamDef,
} from '@grafana/plugin-ui';

import { defaultAddOperationHandler } from './operationUtils';
import { LokiOperationId, LokiVisualQueryOperationCategory } from './types';

export const binaryScalarDefs = [
  {
    id: LokiOperationId.Addition,
    name: 'Add scalar',
    sign: '+',
  },
  {
    id: LokiOperationId.Subtraction,
    name: 'Subtract scalar',
    sign: '-',
  },
  {
    id: LokiOperationId.MultiplyBy,
    name: 'Multiply by scalar',
    sign: '*',
  },
  {
    id: LokiOperationId.DivideBy,
    name: 'Divide by scalar',
    sign: '/',
  },
  {
    id: LokiOperationId.Modulo,
    name: 'Modulo by scalar',
    sign: '%',
  },
  {
    id: LokiOperationId.Exponent,
    name: 'Exponent',
    sign: '^',
  },
  {
    id: LokiOperationId.EqualTo,
    name: 'Equal to',
    sign: '==',
    comparison: true,
  },
  {
    id: LokiOperationId.NotEqualTo,
    name: 'Not equal to',
    sign: '!=',
    comparison: true,
  },
  {
    id: LokiOperationId.GreaterThan,
    name: 'Greater than',
    sign: '>',
    comparison: true,
  },
  {
    id: LokiOperationId.LessThan,
    name: 'Less than',
    sign: '<',
    comparison: true,
  },
  {
    id: LokiOperationId.GreaterOrEqual,
    name: 'Greater or equal to',
    sign: '>=',
    comparison: true,
  },
  {
    id: LokiOperationId.LessOrEqual,
    name: 'Less or equal to',
    sign: '<=',
    comparison: true,
  },
];

// Not sure about this one. It could also be a more generic 'Simple math operation' where user specifies
// both the operator and the operand in a single input
export const binaryScalarOperations: QueryBuilderOperationDefinition[] = binaryScalarDefs.map((opDef) => {
  const params: QueryBuilderOperationParamDef[] = [{ name: 'Value', type: 'number' }];
  let defaultParams: [number] | [number, boolean] = [2];
  if (opDef.comparison) {
    params.push({
      name: 'Bool',
      type: 'boolean',
      description: 'If checked comparison will return 0 or 1 for the value rather than filtering.',
    });
    defaultParams = [2, false];
  }

  return {
    id: opDef.id,
    name: opDef.name,
    params,
    defaultParams,
    toggleable: true,
    alternativesKey: 'binary scalar operations',
    category: LokiVisualQueryOperationCategory.BinaryOps,
    renderer: getSimpleBinaryRenderer(opDef.sign),
    addOperationHandler: defaultAddOperationHandler,
  };
});

function getSimpleBinaryRenderer(operator: string) {
  return function binaryRenderer(
    model: QueryBuilderOperation,
    def: QueryBuilderOperationDefinition,
    innerExpr: string
  ) {
    let param = model.params[0];
    let bool = '';
    if (model.params.length === 2) {
      bool = model.params[1] ? ' bool' : '';
    }

    return `${innerExpr} ${operator}${bool} ${param}`;
  };
}
