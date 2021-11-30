/**
 * Visual query model
 */
export interface PromVisualQuery {
  metric: string;
  labels: PromLabelFilter[];
  operations: PromVisualQueryOperation[];
  binary?: PromVisualQueryBinary;
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
  type: string;
  params?: string[] | number[];
}

export interface PromVisualQueryBinary {
  operator: string;
  expression: number | PromVisualQuery;
}

export interface PromVisualQueryOperationDef {
  type: string;
  params: PromVisualQueryOperationParamDef[];
  defaultParams: string[] | number[];
  renderer: PromVisualQueryOperationRenderer;
}

export type PromVisualQueryOperationRenderer = (
  model: PromVisualQueryOperation,
  def: PromVisualQueryOperationDef,
  innerExpr: string
) => string;

interface PromVisualQueryOperationParamDef {
  name: string;
  type: string;
  options?: string[] | number[];
  multiple?: boolean;
  optional?: boolean;
}
