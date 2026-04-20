import { renderHook } from 'test/test-utils';

import { MIMIR_DATASOURCE_UID } from 'app/features/alerting/unified/mocks/server/constants';
import { AccessControlAction } from 'app/types/accessControl';

import { setupMswServer } from '../../../mockApi';
import { grantUserPermissions } from '../../../mocks';
import { isAvailable } from '../abilityUtils';
import { NotificationTemplateAction } from '../types';

import {
  createAlertmanagerWrapper,
  setupGrafanaAlertmanager,
  setupMimirAlertmanager,
  setupVanillaPrometheusAlertmanager,
} from './abilityTestUtils';
import { useNotificationTemplateAbility } from './useNotificationTemplateAbility';

setupMswServer();

describe('useNotificationTemplateAbility', () => {
  it("should report Create / Update / Delete aren't supported for vanilla prometheus alertmanager", () => {
    const amSource = setupVanillaPrometheusAlertmanager();

    const { result } = renderHook(
      () => ({
        create: useNotificationTemplateAbility({ action: NotificationTemplateAction.Create }),
        update: useNotificationTemplateAbility({ action: NotificationTemplateAction.Update }),
        delete: useNotificationTemplateAbility({ action: NotificationTemplateAction.Delete }),
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
        view: useNotificationTemplateAbility({ action: NotificationTemplateAction.View }),
        create: useNotificationTemplateAbility({ action: NotificationTemplateAction.Create }),
      }),
      { wrapper: createAlertmanagerWrapper(amSource) }
    );

    expect(result.current.view.granted).toBe(true);
    expect(isAvailable(result.current.create)).toBe(true);
    expect(result.current.create.granted).toBe(false);
  });

  it('should return Provisioned for Update/Delete when template is provisioned', () => {
    const amSource = setupGrafanaAlertmanager();
    grantUserPermissions([
      AccessControlAction.AlertingNotificationsRead,
      AccessControlAction.AlertingNotificationsWrite,
    ]);
    const provisionedTemplate = {
      provenance: 'terraform',
      uid: 'x',
      title: 'x',
      content: '',
      kind: 'grafana' as const,
    };

    const { result } = renderHook(
      () => ({
        update: useNotificationTemplateAbility({
          action: NotificationTemplateAction.Update,
          context: provisionedTemplate,
        }),
        delete: useNotificationTemplateAbility({
          action: NotificationTemplateAction.Delete,
          context: provisionedTemplate,
        }),
      }),
      { wrapper: createAlertmanagerWrapper(amSource) }
    );

    expect(result.current.update.granted).toBe(false);
    expect(result.current.delete.granted).toBe(false);
  });

  it('should report template actions for Mimir alertmanager', () => {
    setupMimirAlertmanager(MIMIR_DATASOURCE_UID);
    grantUserPermissions([
      AccessControlAction.AlertingNotificationsExternalRead,
      AccessControlAction.AlertingNotificationsExternalWrite,
    ]);

    const { result } = renderHook(
      () => ({
        view: useNotificationTemplateAbility({ action: NotificationTemplateAction.View }),
        create: useNotificationTemplateAbility({ action: NotificationTemplateAction.Create }),
      }),
      { wrapper: createAlertmanagerWrapper('mimir') }
    );

    expect(result.current).toMatchSnapshot();
  });
});
