import { CurrentUserDTO } from '@grafana/data';
import { User } from 'app/core/services/context_srv';
import { OrgRole } from 'app/types';

export const isPmmAdmin = (user: CurrentUserDTO | User): boolean =>
  user.isGrafanaAdmin || user.orgRole === OrgRole.Admin;
