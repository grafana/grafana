import {
  QueryEditorOperatorExpression as QueryEditorOperatorExpressionBase,
  QueryEditorOperator as QueryEditorOperatorBase,
  QueryEditorOperatorValueType,
  QueryEditorExpressionType,
  QueryEditorExpression,
} from './dataquery.gen';
export {
  QueryEditorPropertyType,
  QueryEditorProperty,
  QueryEditorPropertyExpression,
  QueryEditorGroupByExpression,
  QueryEditorFunctionExpression,
  QueryEditorFunctionParameterExpression,
  QueryEditorArrayExpression,
} from './dataquery.gen';

export { QueryEditorExpressionType, QueryEditorExpression };

export interface QueryEditorOperator<T extends QueryEditorOperatorValueType> extends QueryEditorOperatorBase {
  value?: T;
}

export interface QueryEditorOperatorExpression extends QueryEditorOperatorExpressionBase {
  operator: QueryEditorOperator<QueryEditorOperatorValueType>;
}
