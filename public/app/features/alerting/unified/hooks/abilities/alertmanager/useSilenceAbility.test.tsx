import { renderHook } from 'test/test-utils';

import { MIMIR_DATASOURCE_UID } from 'app/features/alerting/unified/mocks/server/constants';
import { AccessControlAction } from 'app/types/accessControl';

import { setupMswServer } from '../../../mockApi';
import { grantUserPermissions } from '../../../mocks';
import { isAvailable } from '../abilityUtils';
import { SilenceAction } from '../types';

import { createAlertmanagerWrapper, setupGrafanaAlertmanager, setupMimirAlertmanager } from './abilityTestUtils';
import { useSilenceAbility } from './useSilenceAbility';

setupMswServer();

describe('useSilenceAbility', () => {
  it('should grant View and Create when instance read permission is held', () => {
    const amSource = setupGrafanaAlertmanager();
    grantUserPermissions([AccessControlAction.AlertingInstanceRead]);

    const { result } = renderHook(
      () => ({
        view: useSilenceAbility({ action: SilenceAction.View }),
        create: useSilenceAbility({ action: SilenceAction.Create }),
        preview: useSilenceAbility({ action: SilenceAction.Preview }),
      }),
      { wrapper: createAlertmanagerWrapper(amSource) }
    );

    expect(result.current.view.granted).toBe(true);
    expect(result.current.preview.granted).toBe(true);
    expect(isAvailable(result.current.create)).toBe(true);
  });

  it('should deny Update when accessControl.write is false on the silence entity', () => {
    const amSource = setupGrafanaAlertmanager();
    grantUserPermissions([AccessControlAction.AlertingInstanceUpdate]);

    const { result } = renderHook(
      () => ({
        updateDenied: useSilenceAbility({
          action: SilenceAction.Update,
          context: { accessControl: { write: false } } as never,
        }),
        updateAllowed: useSilenceAbility({
          action: SilenceAction.Update,
          context: { accessControl: { write: true } } as never,
        }),
      }),
      { wrapper: createAlertmanagerWrapper(amSource) }
    );

    expect(result.current.updateDenied.granted).toBe(false);
    expect(result.current.updateAllowed.granted).toBe(true);
  });

  it('should report silence actions for Mimir alertmanager', () => {
    setupMimirAlertmanager(MIMIR_DATASOURCE_UID);
    grantUserPermissions([
      AccessControlAction.AlertingInstancesExternalRead,
      AccessControlAction.AlertingInstancesExternalWrite,
    ]);

    const { result } = renderHook(
      () => ({
        view: useSilenceAbility({ action: SilenceAction.View }),
        create: useSilenceAbility({ action: SilenceAction.Create }),
      }),
      { wrapper: createAlertmanagerWrapper('mimir') }
    );

    expect(result.current).toMatchSnapshot();
  });
});
