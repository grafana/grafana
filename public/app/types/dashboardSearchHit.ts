import { DashboardAcl } from './acl';

export interface DashboardSearchHit {
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
