// @todo: replace barrel import path
import { UserOrg } from 'app/types/index';

export interface Organization {
  name: string;
  id: number;
}

export interface OrganizationState {
  organization: Organization;
  userOrgs: UserOrg[];
}
