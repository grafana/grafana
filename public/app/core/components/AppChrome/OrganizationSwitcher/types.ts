import type { SelectableValue } from '@grafana/data/types';
import { type UserOrg } from 'app/types/user';

export interface OrganizationBaseProps {
  orgs: UserOrg[];
  onSelectChange: (option: SelectableValue<UserOrg>) => void;
}
