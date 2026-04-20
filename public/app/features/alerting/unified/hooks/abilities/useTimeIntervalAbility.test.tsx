import { renderHook } from 'test/test-utils';

import { MIMIR_DATASOURCE_UID } from 'app/features/alerting/unified/mocks/server/constants';
import { AccessControlAction } from 'app/types/accessControl';

import { setupMswServer } from '../../mockApi';
import { grantUserPermissions } from '../../mocks';

import {
  createAlertmanagerWrapper,
  setupGrafanaAlertmanager,
  setupMimirAlertmanager,
  setupVanillaPrometheusAlertmanager,
} from './abilityTestUtils';
import { isAvailable } from './abilityUtils';
import { TimeIntervalAction } from './types';
import { useTimeIntervalAbility } from './useTimeIntervalAbility';

setupMswServer();

describe('useTimeIntervalAbility', () => {
  it("should report Create / Update / Delete aren't supported for vanilla prometheus alertmanager", () => {
    const amSource = setupVanillaPrometheusAlertmanager();

    const { result } = renderHook(
      () => ({
        create: useTimeIntervalAbility({ action: TimeIntervalAction.Create }),
        update: useTimeIntervalAbility({ action: TimeIntervalAction.Update }),
        delete: useTimeIntervalAbility({ action: TimeIntervalAction.Delete }),
      }),
      { wrapper: createAlertmanagerWrapper(amSource) }
    );

    expect(result.current).toMatchSnapshot();
  });

  it('should grant View and deny Create when only read permission is held', () => {
    const amSource = setupGrafanaAlertmanager();
    grantUserPermissions([AccessControlAction.AlertingNotificationsRead]);

    const { result } = renderHook(
      () => ({
        view: useTimeIntervalAbility({ action: TimeIntervalAction.View }),
        create: useTimeIntervalAbility({ action: TimeIntervalAction.Create }),
        export: useTimeIntervalAbility({ action: TimeIntervalAction.Export }),
      }),
      { wrapper: createAlertmanagerWrapper(amSource) }
    );

    expect(result.current.view.granted).toBe(true);
    expect(isAvailable(result.current.create)).toBe(true);
    expect(result.current.create.granted).toBe(false);
  });

  it('should return Provisioned for Update/Delete when time interval is provisioned', () => {
    const amSource = setupGrafanaAlertmanager();
    grantUserPermissions([
      AccessControlAction.AlertingNotificationsRead,
      AccessControlAction.AlertingNotificationsWrite,
    ]);
    const provisioned = { provisioned: true } as never;

    const { result } = renderHook(
      () => ({
        update: useTimeIntervalAbility({ action: TimeIntervalAction.Update, context: provisioned }),
        delete: useTimeIntervalAbility({ action: TimeIntervalAction.Delete, context: provisioned }),
      }),
      { wrapper: createAlertmanagerWrapper(amSource) }
    );

    expect(result.current.update.granted).toBe(false);
    expect(result.current.delete.granted).toBe(false);
  });

  it('should report time interval actions for Mimir alertmanager', () => {
    setupMimirAlertmanager(MIMIR_DATASOURCE_UID);
    grantUserPermissions([
      AccessControlAction.AlertingNotificationsExternalRead,
      AccessControlAction.AlertingNotificationsExternalWrite,
    ]);

    const { result } = renderHook(
      () => ({
        view: useTimeIntervalAbility({ action: TimeIntervalAction.View }),
        create: useTimeIntervalAbility({ action: TimeIntervalAction.Create }),
      }),
      { wrapper: createAlertmanagerWrapper('mimir') }
    );

    expect(result.current).toMatchSnapshot();
  });
});
