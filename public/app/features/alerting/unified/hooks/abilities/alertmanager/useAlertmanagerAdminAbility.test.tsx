import { renderHook } from 'test/test-utils';

import { MIMIR_DATASOURCE_UID } from 'app/features/alerting/unified/mocks/server/constants';
import { AccessControlAction } from 'app/types/accessControl';

import { setupMswServer } from '../../../mockApi';
import { grantUserPermissions } from '../../../mocks';
import { isNotSupported } from '../abilityUtils';
import { AlertmanagerAdminAction } from '../types';

import {
  EXTERNAL_AM_VISIBILITY_PERMISSION,
  GRAFANA_AM_VISIBILITY_PERMISSION,
  createAlertmanagerWrapper,
  setupGrafanaAlertmanager,
  setupMimirAlertmanager,
} from './abilityTestUtils';
import { useAlertmanagerAdminAbility } from './useAlertmanagerAdminAbility';

setupMswServer();

describe('useAlertmanagerAdminAbility', () => {
  describe('Grafana alertmanager', () => {
    it('should grant DecryptSecrets when provisioning read secrets permission is held', () => {
      const amSource = setupGrafanaAlertmanager();
      grantUserPermissions([GRAFANA_AM_VISIBILITY_PERMISSION, AccessControlAction.AlertingProvisioningReadSecrets]);

      const { result } = renderHook(() => useAlertmanagerAdminAbility(AlertmanagerAdminAction.DecryptSecrets), {
        wrapper: createAlertmanagerWrapper(amSource),
      });

      expect(result.current.granted).toBe(true);
    });

    it('should deny DecryptSecrets when provisioning read secrets permission is not held', () => {
      const amSource = setupGrafanaAlertmanager();
      grantUserPermissions([GRAFANA_AM_VISIBILITY_PERMISSION]);

      const { result } = renderHook(() => useAlertmanagerAdminAbility(AlertmanagerAdminAction.DecryptSecrets), {
        wrapper: createAlertmanagerWrapper(amSource),
      });

      expect(result.current.granted).toBe(false);
    });
  });

  describe('external (Mimir) alertmanager', () => {
    it('should return NotSupported for DecryptSecrets regardless of permissions held', () => {
      setupMimirAlertmanager(MIMIR_DATASOURCE_UID);
      grantUserPermissions([EXTERNAL_AM_VISIBILITY_PERMISSION, AccessControlAction.AlertingProvisioningReadSecrets]);

      const { result } = renderHook(() => useAlertmanagerAdminAbility(AlertmanagerAdminAction.DecryptSecrets), {
        wrapper: createAlertmanagerWrapper(MIMIR_DATASOURCE_UID),
      });

      expect(isNotSupported(result.current)).toBe(true);
    });
  });
});
