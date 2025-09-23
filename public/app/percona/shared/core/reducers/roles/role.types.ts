import { AccessRole } from 'app/percona/shared/services/roles/Roles.types';

export interface RolesState {
  isLoading: boolean;
  roles: AccessRole[];
}

export interface AssignRoleParams {
  userId: number;
  roleIds: number[];
}
