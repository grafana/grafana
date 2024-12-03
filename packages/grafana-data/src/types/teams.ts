export interface Team {
  id: number; // TODO switch to UUID
  uid: string; // Prefer UUID

  /**
   * AccessControl metadata associated with a given resource.
   */
  accessControl?: Record<string, boolean>;
  /**
   * AvatarUrl is the team's avatar URL.
   */
  avatarUrl?: string;
  /**
   * Email of the team.
   */
  email?: string;
  /**
   * MemberCount is the number of the team members.
   */
  memberCount: number;
  /**
   * Name of the team.
   */
  name: string;
  /**
   * OrgId is the ID of an organisation the team belongs to.
   */
  orgId: number;
  /**
   * TODO - it seems it's a team_member.permission, unlikely it should belong to the team kind
   */
  permission: TeamPermissionLevel;
  /**
   * RBAC roles assigned to the team.
   */
  roles?: Role[];
}

export enum TeamPermissionLevel {
  Admin = 4,
  Editor = 2,
  Member = 0,
  Viewer = 1,
}

export interface Role {
  uid: string;
  name: string;
  displayName: string;
  description: string;
  group: string;
  global: boolean;
  delegatable?: boolean;
  mapped?: boolean;
  version: number;
  created: string;
  updated: string;
}
