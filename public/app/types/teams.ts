export interface Team {
  id: number;
  name: string;
  avatarUrl: string;
  email: string;
  memberCount: number;
}

export interface TeamMember {
  userId: number;
  teamId: number;
  avatarUrl: string;
  email: string;
  login: string;
  labels: string[];
}

export interface TeamGroup {
  groupId: string;
  teamId: number;
}

export interface TeamsState {
  teams: Team[];
  searchQuery: string;
  hasFetched: boolean;
}

export interface TeamState {
  team: Team;
  members: TeamMember[];
  groups: TeamGroup[];
  searchMemberQuery: string;
}
