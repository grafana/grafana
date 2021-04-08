export enum RuleFormType {
  threshold = 'threshold',
  system = 'system',
}

export interface RuleFormValues {
  name?: string;
  type?: RuleFormType;
  dataSourceName: string | null;
  location?: { namespace: string; group: string };
  folder?: { title: string; id: number };
  forTime: number;
  forUnit: string;
  expression?: string;
  labels: Array<{ key: string; value: string }>;
  annotations: Array<{ key: string; value: string }>;
}
