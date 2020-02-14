export enum DashboardSearchHitType {
  DashHitDB = 'dash-db',
  DashHitHome = 'dash-home',
  DashHitFolder = 'dash-folder',
}
export interface DashboardSearchHit {
  id: number;
  uid: string;
  title: string;
  uri: string;
  url: string;
  slug: string;
  type: DashboardSearchHitType;
  tags: string[];
  isStarred: boolean;
  folderId?: number;
  folderUid?: string;
  folderTitle?: string;
  folderUrl?: string;
}
