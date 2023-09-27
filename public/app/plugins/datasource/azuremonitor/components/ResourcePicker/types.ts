export enum ResourceRowType {
  Subscription = 'Subscription',
  ResourceGroup = 'ResourceGroup',
  Resource = 'Resource',
  VariableGroup = 'TemplateVariableGroup',
  Variable = 'TemplateVariable',
}

export interface ResourceRow {
  id: string; // azure's raw data id usually passes along a uri (except in the case of subscriptions), to make things less confusing for ourselves we parse the id string out of the uri or vice versa
  uri: string; // ex: /subscriptions/subid123
  name: string;
  type: ResourceRowType;
  typeLabel: string;
  location?: string;
  children?: ResourceRowGroup;
}

export type ResourceRowGroup = ResourceRow[];
