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
  location?: string;
  children?: RowGroup;
  resourceGroupName?: string;
}

export interface RowGroup {
  [subscriptionIdOrResourceGroupName: string]: Row;
}
