import { User } from 'app/core/services/context_srv';
import { OrgRole } from 'app/types';

export const isPmmAdmin = (user: User): boolean => user.isGrafanaAdmin || user.orgRole === OrgRole.Admin;
