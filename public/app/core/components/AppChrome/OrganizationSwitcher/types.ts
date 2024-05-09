import { SelectableValue } from '@grafana/data';
// @todo: replace barrel import path
import { UserOrg } from 'app/types/index';

export interface OrganizationBaseProps {
  orgs: UserOrg[];
  onSelectChange: (option: SelectableValue<UserOrg>) => void;
}
