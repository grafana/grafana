import { SelectableValue } from '@grafana/data';
import { AccessRole } from 'app/percona/shared/services/roles/Roles.types';

export interface DeleteRoleModalProps {
  role: AccessRole;
  isOpen: boolean;
  onCancel: () => void;
}

export interface DeleteRoleFormValues {
  replacementRoleId: SelectableValue<number>;
}
