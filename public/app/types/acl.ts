import { OrgRole } from '@grafana/data';

export enum TeamPermissionLevel {
  Admin = 4,
  Editor = 2,
  Member = 0,
  Viewer = 1,
}

export { OrgRole as OrgRole };

export enum PermissionLevelString {
  View = 'View',
  Edit = 'Edit',
  Admin = 'Admin',
}

export enum SearchQueryType {
  Folder = 'dash-folder',
  Dashboard = 'dash-db',
}
