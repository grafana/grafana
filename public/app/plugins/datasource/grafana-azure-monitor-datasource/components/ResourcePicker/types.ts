export enum EntryType {
  Collection,
  SubCollection,
  Resource,
}
export interface Row {
  id: string;
  name: string;
  type: EntryType;
  typeLabel: string;
  subscriptionId: string;
  resourceGroup: string;
  location?: string;
  children?: RowGroup;
}

export interface RowGroup {
  [subscriptionIdOrResourceGroupName: string]: Row;
}
