import { DashboardAcl } from './acl';

export interface Dashboard {
  id: number;
  tags: string[];
  title: string;
  type: string;
  uid: string;
  uri: string;
  url: string;
}

export interface DashboardState {
  permissions: DashboardAcl[];
}
