export enum DashboardSearchHitType {
  DashHitDB = 'dash-db',
  DashHitHome = 'dash-home',
  DashHitFolder = 'dash-folder',
}
export interface DashboardSearchHit {
  folderId?: number;
  folderTitle?: string;
  folderUid?: string;
  folderUrl?: string;
  id: number;
  isStarred: boolean;
  slug: string;
  tags: string[];
  title: string;
  type: DashboardSearchHitType;
  uid: string;
  uri: string;
  url: string;
}
