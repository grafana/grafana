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
  children?: Row[];

  hasChildren?: boolean;
  isSelectable?: boolean;

  isOpen?: boolean;
}
