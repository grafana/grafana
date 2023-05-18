import { TeamPermissionLevel } from './acl';

interface TeamBase {
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
}

export interface Team extends TeamBase {
  id: number; // TODO switch to UUID
}

// Represents the data sent via an API to create a team
export interface TeamDTO extends Pick<TeamBase, 'name' | 'email'> {}

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
}

export interface TeamState {
  team: Team;
  members: TeamMember[];
  groups: TeamGroup[];
  searchMemberQuery: string;
}
