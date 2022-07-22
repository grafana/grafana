import { WithAccessControlMetadata } from '@grafana/data';

import { TeamPermissionLevel } from './acl';

export interface Team extends WithAccessControlMetadata {
  id: number;
  name: string;
  avatarUrl: string;
  email: string;
  memberCount: number;
  permission: TeamPermissionLevel;
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
  searchQuery: string;
  searchPage: number;
  hasFetched: boolean;
}

export interface TeamState {
  team: Team;
  members: TeamMember[];
  groups: TeamGroup[];
  searchMemberQuery: string;
}
