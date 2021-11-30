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
  parameters: string[];
}

export interface PromVisualQueryBinary {
  operator: string;
  expression: number | PromVisualQuery;
}
