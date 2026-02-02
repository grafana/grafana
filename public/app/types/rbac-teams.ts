// BMC file
export interface BMCTeam {
  id: number;
  name: string;
  bhdRoleIds: number[];
  isChecked: boolean;
}

export interface BMCTeamsState {
  teams: BMCTeam[];
  totalCount: number;
  selectedCount: number | undefined;
  page: number;
  perPage: number;
  isLoading: boolean;
  searchQuery: string;
  showSelected: boolean;
  teamsAdded: number[];
  teamsRemoved: number[];
}
