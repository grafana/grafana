import {
  QueryEditorExpression,
  QueryEditorExpressionType,
  QueryEditorArrayExpression,
  QueryEditorOperatorExpression,
  QueryEditorPropertyType,
  QueryEditorGroupByExpression,
  QueryEditorFunctionExpression,
  QueryEditorFunctionParameterExpression,
  QueryEditorPropertyExpression,
} from '../expressions';

export function createArray(
  expressions: QueryEditorExpression[],
  type: QueryEditorExpressionType.And | QueryEditorExpressionType.Or = QueryEditorExpressionType.And
) {
  const array: QueryEditorArrayExpression = {
    type,
    expressions,
  };

  return array;
}

export function createOperator(property: string, operator: string, value?: string): QueryEditorOperatorExpression {
  return {
    type: QueryEditorExpressionType.Operator,
    property: {
      name: property,
      type: QueryEditorPropertyType.String,
    },
    operator: {
      name: operator,
      value: value,
    },
  };
}
export function createGroupBy(column: string): QueryEditorGroupByExpression {
  return {
    type: QueryEditorExpressionType.GroupBy,
    property: {
      type: QueryEditorPropertyType.String,
      name: column,
    },
  };
}
export function createFunction(name: string): QueryEditorFunctionExpression {
  return {
    type: QueryEditorExpressionType.Function,
    name,
  };
}

export function createFunctionWithParameter(functionName: string, params: string[]): QueryEditorFunctionExpression {
  const reduce = createFunction(functionName);
  reduce.parameters = params.map((name) => {
    const param: QueryEditorFunctionParameterExpression = {
      type: QueryEditorExpressionType.FunctionParameter,
      name,
    };

    return param;
  });

  return reduce;
}

export function createProperty(name: string): QueryEditorPropertyExpression {
  return {
    type: QueryEditorExpressionType.Property,
    property: {
      type: QueryEditorPropertyType.String,
      name: name,
    },
  };
}
