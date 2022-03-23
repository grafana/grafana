import { UserOrg } from 'app/types';

export interface Organization {
  name: string;
  id: number;
}

export interface OrganizationState {
  organization: Organization;
  userOrgs: UserOrg[];
}
