import { Team as TeamBase } from '@grafana/schema';

export interface Team extends TeamBase {
  id: number; // TODO switch to UUID
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
}

export interface TeamState {
  team: Team;
  members: TeamMember[];
  groups: TeamGroup[];
  searchMemberQuery: string;
}
