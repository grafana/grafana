import { AccessRole } from 'app/percona/shared/services/roles/Roles.types';

export interface DeleteRoleModalProps {
  role: AccessRole;
  isOpen: boolean;
  onCancel: () => void;
}
