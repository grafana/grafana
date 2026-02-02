// BMC file
export interface BMCRole {
  id?: number;
  name: string;
  description?: string;
  systemRole?: boolean;
}

export interface BMCRolesState {
  roles: BMCRole[];
  page: number;
  perPage: number;
  totalCount: number;
  hasFetched: boolean;
  searchRoleQuery: string;
}
