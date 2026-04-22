import { renderHook } from 'test/test-utils';

import { AccessControlAction } from 'app/types/accessControl';

import { setupMswServer } from '../../../mockApi';
import { grantUserPermissions } from '../../../mocks';
import { AlertGroupAction } from '../types';

import {
  GRAFANA_AM_VISIBILITY_PERMISSION,
  createAlertmanagerWrapper,
  setupGrafanaAlertmanager,
} from './abilityTestUtils';
import { useAlertGroupAbility } from './useAlertGroupAbility';

setupMswServer();

describe('useAlertGroupAbility', () => {
  it('should grant View when grafana instance read permission is held', () => {
    const amSource = setupGrafanaAlertmanager();
    grantUserPermissions([GRAFANA_AM_VISIBILITY_PERMISSION, AccessControlAction.AlertingInstanceRead]);

    const { result } = renderHook(() => useAlertGroupAbility(AlertGroupAction.View), {
      wrapper: createAlertmanagerWrapper(amSource),
    });

    expect(result.current.granted).toBe(true);
  });

  it('should grant View when external instance read permission is held', () => {
    const amSource = setupGrafanaAlertmanager();
    grantUserPermissions([GRAFANA_AM_VISIBILITY_PERMISSION, AccessControlAction.AlertingInstancesExternalRead]);

    const { result } = renderHook(() => useAlertGroupAbility(AlertGroupAction.View), {
      wrapper: createAlertmanagerWrapper(amSource),
    });

    expect(result.current.granted).toBe(true);
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
