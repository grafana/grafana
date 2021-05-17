import { OrgRole } from '@grafana/data';
import { config } from '@grafana/runtime';

export function hasRole(requiredRole: OrgRole): boolean {
  const user = config.bootData.user;
  switch (requiredRole) {
    case OrgRole.Admin: {
      return user.orgRole === OrgRole.Admin;
    }
    case OrgRole.Editor: {
      return user.orgRole === OrgRole.Admin || user.orgRole === OrgRole.Editor;
    }
    case OrgRole.Viewer: {
      return user.orgRole === OrgRole.Admin || user.orgRole === OrgRole.Editor || user.orgRole === OrgRole.Viewer;
    }
    default: {
      return false;
    }
  }
}
