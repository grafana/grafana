import { AccessRole } from 'app/percona/shared/services/roles/Roles.types';

export interface AccessRoleRow extends AccessRole {
  isDefault: boolean;
}
