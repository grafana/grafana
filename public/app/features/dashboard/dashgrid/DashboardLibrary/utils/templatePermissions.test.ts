import { contextSrv } from 'app/core/services/context_srv';
import { AccessControlAction } from 'app/types/accessControl';

import { canManageDashboardTemplates, canReadDashboardTemplates } from './templatePermissions';

describe('dashboard template permissions', () => {
  let originalPermissions: typeof contextSrv.user.permissions;

  beforeEach(() => {
    originalPermissions = contextSrv.user.permissions;
  });

  afterEach(() => {
    contextSrv.user.permissions = originalPermissions;
  });

  describe('canReadDashboardTemplates', () => {
    it('returns true when the user has dashboardtemplates:read', () => {
      contextSrv.user.permissions = { [AccessControlAction.DashboardTemplatesRead]: true };
      expect(canReadDashboardTemplates()).toBe(true);
    });

    it('returns false when the user lacks dashboardtemplates:read', () => {
      contextSrv.user.permissions = {};
      expect(canReadDashboardTemplates()).toBe(false);
    });
  });

  describe('canManageDashboardTemplates', () => {
    it('returns true when the user has dashboardtemplates:write', () => {
      contextSrv.user.permissions = { [AccessControlAction.DashboardTemplatesWrite]: true };
      expect(canManageDashboardTemplates()).toBe(true);
    });

    it('returns false when the user lacks dashboardtemplates:write', () => {
      contextSrv.user.permissions = {};
      expect(canManageDashboardTemplates()).toBe(false);
    });
  });
});
