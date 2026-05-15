import { renderHook } from 'test/test-utils';

import { MIMIR_DATASOURCE_UID } from 'app/features/alerting/unified/mocks/server/constants';
import { AccessControlAction } from 'app/types/accessControl';

import { setupMswServer } from '../../../mockApi';
import { grantUserPermissions } from '../../../mocks';
import { isLoading } from '../abilityUtils';
import { AlertGroupAction } from '../types';

import {
  EXTERNAL_AM_VISIBILITY_PERMISSION,
  GRAFANA_AM_VISIBILITY_PERMISSION,
  createAlertmanagerWrapper,
  setupGrafanaAlertmanager,
  setupMimirAlertmanager,
  setupVanillaPrometheusAlertmanager,
} from './abilityTestUtils';
import { useAlertGroupAbility, useGlobalAlertGroupAbility } from './useAlertGroupAbility';

setupMswServer();

describe('useGlobalAlertGroupAbility', () => {
  it('should grant View when grafana instance read permission is held', () => {
    grantUserPermissions([AccessControlAction.AlertingInstanceRead]);

    const { result } = renderHook(() => useGlobalAlertGroupAbility(AlertGroupAction.View));

    expect(result.current.granted).toBe(true);
  });

  it('should grant View when external instance read permission is held', () => {
    grantUserPermissions([AccessControlAction.AlertingInstancesExternalRead]);

    const { result } = renderHook(() => useGlobalAlertGroupAbility(AlertGroupAction.View));

    expect(result.current.granted).toBe(true);
  });

  it('should deny View when no instance read permission is held', () => {
    grantUserPermissions([]);

    const { result } = renderHook(() => useGlobalAlertGroupAbility(AlertGroupAction.View));

    expect(result.current.granted).toBe(false);
  });
});

describe('useAlertGroupAbility', () => {
  describe('Grafana alertmanager', () => {
    it('should grant View when AlertingInstanceRead is held', () => {
      const amSource = setupGrafanaAlertmanager();
      grantUserPermissions([GRAFANA_AM_VISIBILITY_PERMISSION, AccessControlAction.AlertingInstanceRead]);

      const { result } = renderHook(() => useAlertGroupAbility(AlertGroupAction.View), {
        wrapper: createAlertmanagerWrapper(amSource),
      });

      expect(result.current.granted).toBe(true);
    });

    it('should deny View when only the external read permission is held', () => {
      const amSource = setupGrafanaAlertmanager();
      grantUserPermissions([GRAFANA_AM_VISIBILITY_PERMISSION, AccessControlAction.AlertingInstancesExternalRead]);

      const { result } = renderHook(() => useAlertGroupAbility(AlertGroupAction.View), {
        wrapper: createAlertmanagerWrapper(amSource),
      });

      expect(result.current.granted).toBe(false);
    });

    it('should deny View when no instance read permission is held', () => {
      const amSource = setupGrafanaAlertmanager();
      grantUserPermissions([GRAFANA_AM_VISIBILITY_PERMISSION]);

      const { result } = renderHook(() => useAlertGroupAbility(AlertGroupAction.View), {
        wrapper: createAlertmanagerWrapper(amSource),
      });

      expect(result.current.granted).toBe(false);
    });
  });

  describe('external (Mimir) alertmanager', () => {
    it('should grant View when AlertingInstancesExternalRead is held', () => {
      setupMimirAlertmanager(MIMIR_DATASOURCE_UID);
      grantUserPermissions([EXTERNAL_AM_VISIBILITY_PERMISSION, AccessControlAction.AlertingInstancesExternalRead]);

      const { result } = renderHook(() => useAlertGroupAbility(AlertGroupAction.View), {
        wrapper: createAlertmanagerWrapper(MIMIR_DATASOURCE_UID),
      });

      expect(result.current.granted).toBe(true);
    });

    it('should deny View when only the Grafana AM read permission is held', () => {
      setupMimirAlertmanager(MIMIR_DATASOURCE_UID);
      grantUserPermissions([EXTERNAL_AM_VISIBILITY_PERMISSION, AccessControlAction.AlertingInstanceRead]);

      const { result } = renderHook(() => useAlertGroupAbility(AlertGroupAction.View), {
        wrapper: createAlertmanagerWrapper(MIMIR_DATASOURCE_UID),
      });

      expect(result.current.granted).toBe(false);
    });
  });

  describe('unresolved alertmanager (selectedAlertmanager is undefined)', () => {
    it('should return Loading for View when no AM resolves in context', () => {
      // setupVanillaPrometheusAlertmanager returns 'does-not-exist' as the source name,
      // which won't match any available AM. Grant no permissions so neither the
      // Grafana AM nor any external AM appears in availableAlertManagers, ensuring
      // selectedAlertmanager stays undefined in AlertmanagerContext.
      const amSource = setupVanillaPrometheusAlertmanager();
      grantUserPermissions([]);

      const { result } = renderHook(() => useAlertGroupAbility(AlertGroupAction.View), {
        wrapper: createAlertmanagerWrapper(amSource),
      });

      expect(isLoading(result.current)).toBe(true);
    });
  });
});
