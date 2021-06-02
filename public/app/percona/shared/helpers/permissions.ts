import { OrgRole } from 'app/types';
import { User } from 'app/core/services/context_srv';

export const isPmmAdmin = (user: User): boolean => user.isGrafanaAdmin || user.orgRole === OrgRole.Admin;
