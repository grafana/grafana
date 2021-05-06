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
  location?: string;
  hasChildren?: boolean;
  children?: Row[];
  isSelectable?: boolean;
}
