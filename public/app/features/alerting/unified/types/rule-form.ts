export enum RuleFormType {
  threshold = 'threshold',
  system = 'system',
}

export interface RuleFormValues {
  name?: string;
  type?: RuleFormType;
  dataSourceName: string | null;
  namespace?: string;
  group?: string;
  forTime: number;
  forUnit: string;
  expression?: string;
  labels: Array<{ key: string; value: string }>;
  annotations: Array<{ key: string; value: string }>;
}
