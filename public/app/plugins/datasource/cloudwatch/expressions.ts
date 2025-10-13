import {
  QueryEditorOperatorExpression as QueryEditorOperatorExpressionBase,
  QueryEditorOperator as QueryEditorOperatorBase,
  QueryEditorOperatorValueType,
} from './dataquery.gen';
export {
  QueryEditorPropertyType,
  type QueryEditorProperty,
  type QueryEditorPropertyExpression,
  type QueryEditorGroupByExpression,
  type QueryEditorFunctionExpression,
  type QueryEditorFunctionParameterExpression,
  type QueryEditorArrayExpression,
  QueryEditorExpressionType,
  type QueryEditorExpression,
} from './dataquery.gen';

export interface QueryEditorOperator<T extends QueryEditorOperatorValueType> extends QueryEditorOperatorBase {
  value?: T;
}

export interface QueryEditorOperatorExpression extends QueryEditorOperatorExpressionBase {
  operator: QueryEditorOperator<QueryEditorOperatorValueType>;
}
