import { defaultAddOperationHandler } from './shared/operationUtils';
import { QueryBuilderOperation, QueryBuilderOperationDef, QueryBuilderOperationParamDef } from './shared/types';
import { PromOperationId, PromVisualQueryOperationCategory } from './types';

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
    comparison: true,
  },
  {
    id: PromOperationId.NotEqualTo,
    name: 'Not equal to',
    sign: '!=',
    comparison: true,
  },
  {
    id: PromOperationId.GreaterThan,
    name: 'Greater than',
    sign: '>',
    comparison: true,
  },
  {
    id: PromOperationId.LessThan,
    name: 'Less than',
    sign: '<',
    comparison: true,
  },
  {
    id: PromOperationId.GreaterOrEqual,
    name: 'Greater or equal to',
    sign: '>=',
    comparison: true,
  },
  {
    id: PromOperationId.LessOrEqual,
    name: 'Less or equal to',
    sign: '<=',
    comparison: true,
  },
];

export const binaryScalarOperatorToOperatorName = binaryScalarDefs.reduce((acc, def) => {
  acc[def.sign] = {
    id: def.id,
    comparison: def.comparison,
  };
  return acc;
}, {} as Record<string, { id: string; comparison?: boolean }>);

// Not sure about this one. It could also be a more generic 'Simple math operation' where user specifies
// both the operator and the operand in a single input
export const binaryScalarOperations: QueryBuilderOperationDef[] = binaryScalarDefs.map((opDef) => {
  const params: QueryBuilderOperationParamDef[] = [{ name: 'Value', type: 'number' }];
  const defaultParams: any[] = [2];
  if (opDef.comparison) {
    params.push({
      name: 'Bool',
      type: 'boolean',
      description: 'If checked comparison will return 0 or 1 for the value rather than filtering.',
    });
    defaultParams.push(false);
  }

  return {
    id: opDef.id,
    name: opDef.name,
    params,
    defaultParams,
    alternativesKey: 'binary scalar operations',
    category: PromVisualQueryOperationCategory.BinaryOps,
    renderer: getSimpleBinaryRenderer(opDef.sign),
    addOperationHandler: defaultAddOperationHandler,
  };
});

function getSimpleBinaryRenderer(operator: string) {
  return function binaryRenderer(model: QueryBuilderOperation, def: QueryBuilderOperationDef, innerExpr: string) {
    let param = model.params[0];
    let bool = '';
    if (model.params.length === 2) {
      bool = model.params[1] ? ' bool' : '';
    }

    return `${innerExpr} ${operator}${bool} ${param}`;
  };
}
