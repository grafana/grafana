/**
 * Visual query model
 */
export interface PromVisualQuery {
  metric: string;
  labels: PromLabelFilter[];
  operations: PromVisualQueryOperation[];
  nestedQueries?: PromVisualQueryNested[];
}

export interface PromLabelFilter {
  label: string;
  op: string;
  value: string;
}

/**
 * Functions, group by and other elements
 */
export interface PromVisualQueryOperation {
  id: string;
  params: string[] | number[];
}

export interface PromVisualQueryNested {
  operator: string;
  query: PromVisualQuery;
}

export interface PromVisualQueryOperationDef {
  id: string;
  displayName?: string;
  params: PromVisualQueryOperationParamDef[];
  defaultParams: string[] | number[];
  category: string;
  renderer: PromVisualQueryOperationRenderer;
  addHandler: (operation: PromVisualQueryOperationDef, query: PromVisualQuery) => PromVisualQuery;
}

export type PromVisualQueryOperationRenderer = (
  model: PromVisualQueryOperation,
  def: PromVisualQueryOperationDef,
  innerExpr: string
) => string;

export interface PromVisualQueryOperationParamDef {
  name: string;
  type: string;
  options?: string[] | number[];
  restParam?: boolean;
  optional?: boolean;
}

export enum PromVisualQueryOperationCategory {
  Aggregations = 'Aggregations',
  GroupBy = 'Group by',
  RateAndDeltas = 'Rates & counters',
  Functions = 'Misc functions',
  Math = 'Math',
}

export const operationTopLevelCategories = [
  PromVisualQueryOperationCategory.Aggregations,
  PromVisualQueryOperationCategory.RateAndDeltas,
  PromVisualQueryOperationCategory.GroupBy,
  PromVisualQueryOperationCategory.Functions,
  PromVisualQueryOperationCategory.Math,
];

export interface PromQueryPattern {
  name: string;
  operations: PromVisualQueryOperation[];
}

export function getDefaultTestQuery() {
  const model: PromVisualQuery = {
    metric: 'cortex_query_scheduler_queue_duration_seconds_bucket',
    labels: [
      { label: 'cluster', op: '=~', value: '$cluster' },
      { label: 'job', op: '=~', value: '($namespace)/query-scheduler.*' },
    ],
    operations: [
      { id: 'rate', params: ['auto'] },
      { id: '__group_by', params: ['sum', 'job'] },
    ],
  };

  return model;
}
