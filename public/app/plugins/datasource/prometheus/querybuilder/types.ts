interface PromQueryModel {
  metric: string;
  labels: PromLabelFilter[];
  binary?: PromBinaryOperation;
}

interface PromLabelFilter {
  label: string;
  operator: string;
  value: string;
}

interface PromQueryModifier {
  name: string;
  parameters: string[];
}

interface PromBinaryOperation {
  operator: string;
  expression: number | PromQueryModel;
}
