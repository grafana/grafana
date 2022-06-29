import { CurrentUserDTO } from '@grafana/data';
import { OrgRole } from 'app/types';

export const isPmmAdmin = (user: CurrentUserDTO): boolean => user.isGrafanaAdmin || user.orgRole === OrgRole.Admin;
