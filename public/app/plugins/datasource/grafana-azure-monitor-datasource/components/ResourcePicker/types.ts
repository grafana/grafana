export enum ResourceRowType {
  Subscription = 'Subscription',
  ResourceGroup = 'ResourceGroup',
  Resource = 'Resource',
  VariableGroup = 'TemplateVariableGroup',
  Variable = 'TemplateVariable',
}

export interface ResourceRow {
  id: string;
  name: string;
  type: ResourceRowType;
  typeLabel: string;
  location?: string;
  children?: ResourceRowGroup;
}

export type ResourceRowGroup = ResourceRow[];
