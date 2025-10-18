export enum TeamPermissionLevel {
  Admin = 4,
  Member = 0,
}

export type PermissionLevel = 'view' | 'edit' | 'admin';

export enum SearchQueryType {
  Folder = 'dash-folder',
  Dashboard = 'dash-db',
}
