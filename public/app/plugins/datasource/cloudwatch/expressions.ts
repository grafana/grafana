import {
  QueryEditorOperatorExpression as QueryEditorOperatorExpressionBase,
  QueryEditorOperator as QueryEditorOperatorBase,
  QueryEditorOperatorValueType,
} from './dataquery.gen';
export {
  QueryEditorPropertyType,
  QueryEditorProperty,
  QueryEditorPropertyExpression,
  QueryEditorGroupByExpression,
  QueryEditorFunctionExpression,
  QueryEditorFunctionParameterExpression,
  QueryEditorArrayExpression,
  QueryEditorExpressionType,
  QueryEditorExpression,
} from './dataquery.gen';

export interface QueryEditorOperator<T extends QueryEditorOperatorValueType> extends QueryEditorOperatorBase {
  value?: T;
}

export interface QueryEditorOperatorExpression extends QueryEditorOperatorExpressionBase {
  operator: QueryEditorOperator<QueryEditorOperatorValueType>;
}
