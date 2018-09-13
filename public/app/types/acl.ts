export interface DashboardAclDTO {
  id?: number;
  dashboardId?: number;
  userId?: number;
  userLogin?: string;
  userEmail?: string;
  teamId?: number;
  team?: string;
  permission?: PermissionLevel;
  permissionName?: string;
  role?: string;
  icon?: string;
  inherited?: boolean;
}

export interface DashboardAclUpdateDTO {
  userId: number;
  teamId: number;
  role: string;
  permission: PermissionLevel;
}

export interface DashboardAcl {
  id?: number;
  dashboardId?: number;
  userId?: number;
  userLogin?: string;
  userEmail?: string;
  teamId?: number;
  team?: string;
  permission?: PermissionLevel;
  permissionName?: string;
  role?: string;
  icon?: string;
  name?: string;
  inherited?: boolean;
  sortRank?: number;
}

export interface DashboardPermissionInfo {
  value: PermissionLevel;
  label: string;
  description: string;
}

export enum PermissionLevel {
  View = 1,
  Edit = 2,
  Admin = 4,
}

export const dashboardPermissionLevels: DashboardPermissionInfo[] = [
  { value: PermissionLevel.View, label: 'View', description: 'Can view dashboards.' },
  { value: PermissionLevel.Edit, label: 'Edit', description: 'Can add, edit and delete dashboards.' },
  {
    value: PermissionLevel.Admin,
    label: 'Admin',
    description: 'Can add/remove permissions and can add, edit and delete dashboards.',
  },
];
