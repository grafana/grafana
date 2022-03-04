import { QueryBuilderOperation, QueryBuilderOperationDef } from './shared/types';
import { PromOperationId, PromVisualQueryOperationCategory } from './types';
import { defaultAddOperationHandler } from './shared/operationUtils';

export const binaryScalarDefs = [
  {
    id: PromOperationId.Addition,
    name: 'Add scalar',
    sign: '+',
  },
  {
    id: PromOperationId.Subtraction,
    name: 'Subtract scalar',
    sign: '-',
  },
  {
    id: PromOperationId.MultiplyBy,
    name: 'Multiply by scalar',
    sign: '*',
  },
  {
    id: PromOperationId.DivideBy,
    name: 'Divide by scalar',
    sign: '/',
  },
  {
    id: PromOperationId.Modulo,
    name: 'Modulo by scalar',
    sign: '%',
  },
  {
    id: PromOperationId.Exponent,
    name: 'Exponent',
    sign: '^',
  },
  {
    id: PromOperationId.EqualTo,
    name: 'Equal to',
    sign: '==',
  },
  {
    id: PromOperationId.NotEqualTo,
    name: 'Not equal to',
    sign: '!=',
  },
  {
    id: PromOperationId.GreaterThan,
    name: 'Greater than',
    sign: '>',
  },
  {
    id: PromOperationId.LessThan,
    name: 'Less than',
    sign: '<',
  },
  {
    id: PromOperationId.GreaterOrEqual,
    name: 'Greater or equal to',
    sign: '>=',
  },
  {
    id: PromOperationId.LessOrEqual,
    name: 'Less or equal to',
    sign: '<=',
  },
];

// Not sure about this one. It could also be a more generic 'Simple math operation' where user specifies
// both the operator and the operand in a single input
export const binaryScalarOperations = binaryScalarDefs.map((opDef) => {
  return {
    id: opDef.id,
    name: opDef.name,
    params: [{ name: 'Value', type: 'number' }],
    defaultParams: [2],
    alternativesKey: 'binary scalar operations',
    category: PromVisualQueryOperationCategory.BinaryOps,
    renderer: getSimpleBinaryRenderer(opDef.sign),
    addOperationHandler: defaultAddOperationHandler,
  };
});

function getSimpleBinaryRenderer(operator: string) {
  return function binaryRenderer(model: QueryBuilderOperation, def: QueryBuilderOperationDef, innerExpr: string) {
    return `${innerExpr} ${operator} ${model.params[0]}`;
  };
}
