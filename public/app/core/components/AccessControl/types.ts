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
};

export type SetPermission = {
  userId?: number;
  teamId?: number;
  builtInRole?: string;
  permission: string;
  target: PermissionTarget;
  actions?: string[];
};

export enum PermissionTarget {
  None = 'None',
  Team = 'Team',
  User = 'User',
  ServiceAccount = 'ServiceAccount',
  BuiltInRole = 'builtInRole',
}
export type Description = {
  resource: string;
  assignments: Assignments;
  permissions: string[];
  fineGrainedActions: string[];
};

export type Assignments = {
  users: boolean;
  serviceAccounts: boolean;
  teams: boolean;
  builtInRoles: boolean;
};
