export enum TeamPermissionLevel {
  Admin = 4,
  Member = 0,
}

export type PermissionLevel = 'view' | 'edit' | 'admin';

enum SearchQueryType {
  Folder = 'dash-folder',
  Dashboard = 'dash-db',
}
