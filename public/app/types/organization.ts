import { UserOrg } from 'app/types/user';

export interface Organization {
  name: string;
  id: number;
}

export interface OrganizationState {
  organization: Organization;
  userOrgs: UserOrg[];
}
