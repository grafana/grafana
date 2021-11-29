export type SystemDescription = {
  assignments: Assignments;
  permissions: string[];
};

export type Assignments = {
  users: boolean;
  teams: boolean;
  builtInRoles: boolean;
};

export type ResourcePermission = {
  resourceId: string;
  managed: boolean;
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

export type SetResourcePermission = {
  userId?: number;
  teamId?: number;
  builtInRole?: string;
  permission: string;
  target: AclTarget;
};

export enum AclTarget {
  Team = 'Team',
  User = 'User',
  BuiltInRole = 'builtInRole',
}
