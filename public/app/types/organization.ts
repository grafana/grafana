import { UserOrg } from 'app/types';

export interface Organization {
  name: string;
  id: number;
}

export interface OrganizationState {
  userOrgs: UserOrg[];
}
