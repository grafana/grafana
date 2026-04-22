import {
  type QueryEditorOperatorExpression as QueryEditorOperatorExpressionBase,
  type QueryEditorOperator as QueryEditorOperatorBase,
  type QueryEditorOperatorValueType,
} from './dataquery.gen';

export interface QueryEditorOperator<T extends QueryEditorOperatorValueType> extends QueryEditorOperatorBase {
  value?: T;
}

export interface QueryEditorOperatorExpression extends QueryEditorOperatorExpressionBase {
  operator: QueryEditorOperator<QueryEditorOperatorValueType>;
}
