import { WithAccessControlMetadata } from '@grafana/data';

import { Role } from './accessControl';

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
export interface Team extends WithAccessControlMetadata {
  /**
   * Internal id of team
   * @deprecated use uid instead
   */
  id: number;
  /**
   * A unique identifier for the team.
   */
  uid: string; // Prefer UUID
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
   * isProvisioned is set if the team has been provisioned from IdP.
   */
  isProvisioned: boolean;
}

export interface TeamWithRoles extends Team {
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
