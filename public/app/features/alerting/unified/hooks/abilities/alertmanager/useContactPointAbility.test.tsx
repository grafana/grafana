import { renderHook } from 'test/test-utils';

import { MIMIR_DATASOURCE_UID } from 'app/features/alerting/unified/mocks/server/constants';
import { AccessControlAction } from 'app/types/accessControl';

import { setupMswServer } from '../../../mockApi';
import { grantUserPermissions } from '../../../mocks';
import {
  createAlertmanagerWrapper,
  setupGrafanaAlertmanager,
  setupMimirAlertmanager,
  setupVanillaPrometheusAlertmanager,
} from '../abilityTestUtils';
import { isAvailable } from '../abilityUtils';
import { ContactPointAction, isInsufficientPermissions } from '../types';

import { useContactPointAbility } from './useContactPointAbility';

setupMswServer();

describe('useContactPointAbility', () => {
  it("should report Create / Update / Delete aren't supported for vanilla prometheus alertmanager", () => {
    const amSource = setupVanillaPrometheusAlertmanager();

    const { result } = renderHook(
      () => ({
        create: useContactPointAbility({ action: ContactPointAction.Create }),
        update: useContactPointAbility({ action: ContactPointAction.Update, context: {} }),
        delete: useContactPointAbility({ action: ContactPointAction.Delete, context: {} }),
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
        view: useContactPointAbility({ action: ContactPointAction.View }),
        create: useContactPointAbility({ action: ContactPointAction.Create }),
        bulkExport: useContactPointAbility({ action: ContactPointAction.BulkExport }),
        export: useContactPointAbility({ action: ContactPointAction.Export, context: {} }),
      }),
      { wrapper: createAlertmanagerWrapper(amSource) }
    );

    expect(result.current.view.granted).toBe(true);
    expect(result.current.bulkExport.granted).toBe(true);
    expect(result.current.export.granted).toBe(true);
    expect(isAvailable(result.current.create)).toBe(true);
    expect(result.current.create.granted).toBe(false);
    expect(isInsufficientPermissions(result.current.create)).toBe(true);
  });

  it('should report contact point actions as not supported for Mimir alertmanager', () => {
    setupMimirAlertmanager(MIMIR_DATASOURCE_UID);
    grantUserPermissions([
      AccessControlAction.AlertingNotificationsExternalRead,
      AccessControlAction.AlertingNotificationsExternalWrite,
    ]);

    const { result } = renderHook(
      () => ({
        view: useContactPointAbility({ action: ContactPointAction.View }),
        create: useContactPointAbility({ action: ContactPointAction.Create }),
        export: useContactPointAbility({ action: ContactPointAction.Export, context: {} }),
      }),
      { wrapper: createAlertmanagerWrapper('mimir') }
    );

    expect(result.current).toMatchSnapshot();
  });
});
