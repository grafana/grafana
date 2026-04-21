import { renderHook } from 'test/test-utils';

import { AccessControlAction } from 'app/types/accessControl';

import { setupMswServer } from '../../../mockApi';
import { grantUserPermissions } from '../../../mocks';
import { AlertmanagerAdminAction } from '../types';

import {
  GRAFANA_AM_VISIBILITY_PERMISSION,
  createAlertmanagerWrapper,
  setupGrafanaAlertmanager,
} from './abilityTestUtils';
import { useAlertmanagerAdminAbility } from './useAlertmanagerAdminAbility';

setupMswServer();

describe('useAlertmanagerAdminAbility', () => {
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
