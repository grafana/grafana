import { SelectableValue } from '@grafana/data';
import { AccessRole } from 'app/percona/shared/services/roles/Roles.types';

export const toOptions = (roles: AccessRole[]): Array<SelectableValue<number>> =>
  roles.map((role) => ({
    label: role.title,
    value: role.roleId,
    ariaLabel: role.title,
  }));

export const idsToOptions = (ids: number[], roles: AccessRole[]): Array<SelectableValue<number>> =>
  toOptions(roles.filter((r) => ids.includes(r.roleId)));
