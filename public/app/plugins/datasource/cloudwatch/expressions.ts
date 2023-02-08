import {
  QueryEditorOperatorExpression as QueryEditorOperatorExpressionBase,
  QueryEditorOperator as QueryEditorOperatorBase,
  QueryEditorOperatorValueType,
  QueryEditorExpressionType,
  QueryEditorExpression as QueryEditorExpressionBase,
  QueryEditorArrayExpression as QueryEditorArrayExpressionBase,
} from './dataquery.gen';
export {
  QueryEditorPropertyType,
  QueryEditorProperty,
  QueryEditorPropertyExpression,
  QueryEditorGroupByExpression,
  QueryEditorFunctionExpression,
  QueryEditorFunctionParameterExpression,
} from './dataquery.gen';

export { QueryEditorExpressionType };

export interface QueryEditorOperator<T extends QueryEditorOperatorValueType> extends QueryEditorOperatorBase {
  value?: T;
}

export interface QueryEditorOperatorExpression extends QueryEditorOperatorExpressionBase {
  operator: QueryEditorOperator<QueryEditorOperatorValueType>;
}

export interface QueryEditorArrayExpression extends QueryEditorArrayExpressionBase {
  type: QueryEditorExpressionType.And | QueryEditorExpressionType.Or;
  expressions: QueryEditorExpression[] | QueryEditorArrayExpression[];
}

export type QueryEditorExpression = QueryEditorExpressionBase | QueryEditorArrayExpression;
