// BMC file
export interface BMCUser {
  id: number;
  name: string;
  login: string;
  email: string;
  bhdRoleIds: number[];
  isChecked: boolean;
}

export interface BMCUsersState {
  users: BMCUser[];
  totalCount: number;
  selectedCount: number | undefined;
  page: number;
  perPage: number;
  isLoading: boolean;
  searchQuery: string;
  showSelected: boolean;
  usersAdded: number[];
  usersRemoved: number[];
}
