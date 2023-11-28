import { OrgRole } from 'app/types';
export const isPmmAdmin = (user) => user.isGrafanaAdmin || user.orgRole === OrgRole.Admin;
//# sourceMappingURL=permissions.js.map