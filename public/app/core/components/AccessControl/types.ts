export type ResourcePermission = {
  id: number;
  resourceId: string;
  isManaged: boolean;
  isInherited: boolean;
  isServiceAccount: boolean;
  userId?: number;
  userLogin?: string;
  userAvatarUrl?: string;
  team?: string;
  teamId?: number;
  teamAvatarUrl?: string;
  builtInRole?: string;
  actions: string[];
  permission: string;
  warning?: string;
};

export type SetPermission = {
  userId?: number;
  teamId?: number;
  builtInRole?: string;
  permission: string;
  target: PermissionTarget;
};

export enum PermissionTarget {
  None = 'None',
  Team = 'Team',
  User = 'User',
  ServiceAccount = 'ServiceAccount',
  BuiltInRole = 'builtInRole',
}
export type Description = {
  assignments: Assignments;
  permissions: string[];
};

export type Assignments = {
  users: boolean;
  serviceAccounts: boolean;
  teams: boolean;
  builtInRoles: boolean;
};
