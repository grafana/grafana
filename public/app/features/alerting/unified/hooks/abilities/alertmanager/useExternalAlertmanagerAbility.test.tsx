import { renderHook } from 'test/test-utils';

import { MIMIR_DATASOURCE_UID } from 'app/features/alerting/unified/mocks/server/constants';
import { AccessControlAction } from 'app/types/accessControl';

import { setupMswServer } from '../../../mockApi';
import { grantUserPermissions } from '../../../mocks';
import { isNotSupported } from '../abilityUtils';
import { ExternalAlertmanagerAction } from '../types';

import {
  EXTERNAL_AM_VISIBILITY_PERMISSION,
  createAlertmanagerWrapper,
  setupMimirAlertmanager,
  setupVanillaPrometheusAlertmanager,
} from './abilityTestUtils';
import { useExternalAlertmanagerAbility } from './useExternalAlertmanagerAbility';

setupMswServer();

describe('useExternalAlertmanagerAbility', () => {
  describe('ViewExternalConfiguration', () => {
    it('should grant View when external read permission is held', () => {
      setupMimirAlertmanager(MIMIR_DATASOURCE_UID);
      grantUserPermissions([EXTERNAL_AM_VISIBILITY_PERMISSION, AccessControlAction.AlertingNotificationsExternalRead]);

      const { result } = renderHook(
        () => useExternalAlertmanagerAbility(ExternalAlertmanagerAction.ViewExternalConfiguration),
        { wrapper: createAlertmanagerWrapper(MIMIR_DATASOURCE_UID) }
      );

      expect(result.current.granted).toBe(true);
    });

    it('should deny View when external read permission is not held', () => {
      // Note: EXTERNAL_AM_VISIBILITY_PERMISSION is AlertingNotificationsExternalRead — the same
      // permission that gates ViewExternalConfiguration. Grant no permissions to test denial;
      // ViewExternalConfiguration is a pure RBAC check so no AM context resolution is needed.
      setupMimirAlertmanager(MIMIR_DATASOURCE_UID);
      grantUserPermissions([]);

      const { result } = renderHook(
        () => useExternalAlertmanagerAbility(ExternalAlertmanagerAction.ViewExternalConfiguration),
        { wrapper: createAlertmanagerWrapper(MIMIR_DATASOURCE_UID) }
      );

      expect(result.current.granted).toBe(false);
    });
  });

  describe('UpdateExternalConfiguration', () => {
    it('should grant Update when external write permission is held and AM has a configuration API (Mimir)', () => {
      setupMimirAlertmanager(MIMIR_DATASOURCE_UID);
      grantUserPermissions([EXTERNAL_AM_VISIBILITY_PERMISSION, AccessControlAction.AlertingNotificationsExternalWrite]);

      const { result } = renderHook(
        () => useExternalAlertmanagerAbility(ExternalAlertmanagerAction.UpdateExternalConfiguration),
        { wrapper: createAlertmanagerWrapper(MIMIR_DATASOURCE_UID) }
      );

      expect(result.current.granted).toBe(true);
    });

    it('should return NotSupported for Update when AM has no configuration API (vanilla Prometheus)', () => {
      // Vanilla Prometheus alertmanager does not support the configuration API,
      // so hasConfigurationAPI is false and Update is NotSupported regardless of permissions.
      const amSource = setupVanillaPrometheusAlertmanager();
      grantUserPermissions([AccessControlAction.AlertingNotificationsExternalWrite]);

      const { result } = renderHook(
        () => useExternalAlertmanagerAbility(ExternalAlertmanagerAction.UpdateExternalConfiguration),
        { wrapper: createAlertmanagerWrapper(amSource) }
      );

      expect(isNotSupported(result.current)).toBe(true);
    });

    it('should deny Update when external write permission is not held', () => {
      setupMimirAlertmanager(MIMIR_DATASOURCE_UID);
      grantUserPermissions([EXTERNAL_AM_VISIBILITY_PERMISSION]);

      const { result } = renderHook(
        () => useExternalAlertmanagerAbility(ExternalAlertmanagerAction.UpdateExternalConfiguration),
        { wrapper: createAlertmanagerWrapper(MIMIR_DATASOURCE_UID) }
      );

      expect(result.current.granted).toBe(false);
    });
  });
});
