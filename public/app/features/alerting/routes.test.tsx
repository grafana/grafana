import { contextSrv } from 'app/core/services/context_srv';
import { AccessControlAction } from 'app/types/accessControl';

import { getAlertingRoutes } from './routes';

describe('alerting route guards', () => {
  const previousPermissions = contextSrv.user.permissions;

  afterEach(() => {
    contextSrv.user.permissions = previousPermissions;
  });

  function getRouteRolesGuard(path: string) {
    const route = getAlertingRoutes().find((r) => r.path === path);
    if (!route?.roles) {
      throw new Error(`Route not found or has no roles guard: ${path}`);
    }
    return route.roles;
  }

  const groupEditPath = '/alerting/:dataSourceUid/namespaces/:namespaceId/groups/:groupName/edit';
  const groupViewPath = '/alerting/:dataSourceUid/namespaces/:namespaceId/groups/:groupName/view';

  describe('Alert Group edit route', () => {
    it('rejects users with only read permissions (Viewer)', () => {
      contextSrv.user.permissions = {
        [AccessControlAction.AlertingRuleRead]: true,
        [AccessControlAction.AlertingRuleExternalRead]: true,
      };

      const guard = getRouteRolesGuard(groupEditPath);
      expect(guard()).toEqual(['Reject']);
    });

    it('allows users with Grafana-managed update permission', () => {
      contextSrv.user.permissions = {
        [AccessControlAction.AlertingRuleRead]: true,
        [AccessControlAction.AlertingRuleUpdate]: true,
      };

      const guard = getRouteRolesGuard(groupEditPath);
      expect(guard()).toEqual([]);
    });

    it('allows users with external write permission', () => {
      contextSrv.user.permissions = {
        [AccessControlAction.AlertingRuleExternalRead]: true,
        [AccessControlAction.AlertingRuleExternalWrite]: true,
      };

      const guard = getRouteRolesGuard(groupEditPath);
      expect(guard()).toEqual([]);
    });
  });

  describe('Alert Group view route', () => {
    it('allows users with only read permissions (Viewer)', () => {
      contextSrv.user.permissions = {
        [AccessControlAction.AlertingRuleRead]: true,
        [AccessControlAction.AlertingRuleExternalRead]: true,
      };

      const guard = getRouteRolesGuard(groupViewPath);
      expect(guard()).toEqual([]);
    });
  });

  describe('Import to Grafana Alerting route', () => {
    const importToGmaPath = '/alerting/import-to-gma';

    it('allows users holding both convert permissions', () => {
      contextSrv.user.permissions = {
        [AccessControlAction.AlertingRuleCreate]: true,
        [AccessControlAction.AlertingProvisioningSetStatus]: true,
      };

      const guard = getRouteRolesGuard(importToGmaPath);
      expect(guard()).toEqual([]);
    });

    it('rejects users with only rule-create permission', () => {
      contextSrv.user.permissions = {
        [AccessControlAction.AlertingRuleCreate]: true,
      };

      const guard = getRouteRolesGuard(importToGmaPath);
      expect(guard()).toEqual(['Reject']);
    });

    it('rejects users with only provisioning-set-status permission', () => {
      contextSrv.user.permissions = {
        [AccessControlAction.AlertingProvisioningSetStatus]: true,
      };

      const guard = getRouteRolesGuard(importToGmaPath);
      expect(guard()).toEqual(['Reject']);
    });

    it('rejects users with neither permission', () => {
      contextSrv.user.permissions = {};

      const guard = getRouteRolesGuard(importToGmaPath);
      expect(guard()).toEqual(['Reject']);
    });
  });
});
