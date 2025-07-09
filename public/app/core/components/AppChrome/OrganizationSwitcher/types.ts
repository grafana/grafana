import { SelectableValue } from '@grafana/data';
import { UserOrg } from 'app/types/user';

export interface OrganizationBaseProps {
  orgs: UserOrg[];
  onSelectChange: (option: SelectableValue<UserOrg>) => void;
}
