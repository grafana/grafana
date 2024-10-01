import { Role } from './accessControl';
import { TeamPermissionLevel } from './acl';

export interface TeamDTO {
  /**
   * Email of the team.
   */
  email?: string;
  /**
   * Name of the team.
   */
  name: string;
}

// This is the team resource with permissions and metadata expanded
export interface Team {
  id: number; // TODO switch to UUID

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

export interface TeamMember {
  userId: number;
  teamId: number;
  avatarUrl: string;
  email: string;
  name: string;
  login: string;
  labels: string[];
  permission: number;
}

export interface TeamGroup {
  groupId: string;
  teamId: number;
}

export interface TeamsState {
  teams: Team[];
  page: number;
  query: string;
  perPage: number;
  noTeams: boolean;
  totalPages: number;
  hasFetched: boolean;
  sort?: string;
  rolesLoading?: boolean;
}

export interface TeamState {
  team: Team;
  members: TeamMember[];
  groups: TeamGroup[];
  searchMemberQuery: string;
}
