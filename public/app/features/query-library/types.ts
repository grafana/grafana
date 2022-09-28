export interface QueryItem {
  id: number;
  selected?: boolean;
  tags: string[];
  title: string;
  type: string;
  uid: string;
  ds_uid: string[];
  uri: string;
  url: string;
  sortMeta?: number;
  sortMetaName?: string;
  location?: string;
}
