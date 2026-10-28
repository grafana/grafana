import { contextSrv } from 'app/core/services/context_srv';
import { AccessControlAction } from 'app/types/accessControl';
import { type OrgUser } from 'app/types/user';

export function getBasicRoleDisabled(user: Pick<OrgUser, 'accessControl' | 'isExternallySynced' | 'isProvisioned'>) {
  return (
    !contextSrv.hasPermissionInMetadata(AccessControlAction.OrgUsersWrite, user) ||
    !!user.isExternallySynced ||
    !!user.isProvisioned
  );
}
