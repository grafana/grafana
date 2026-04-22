import { renderHook } from 'test/test-utils';

import { MIMIR_DATASOURCE_UID } from 'app/features/alerting/unified/mocks/server/constants';
import { AccessControlAction } from 'app/types/accessControl';

import { setupMswServer } from '../../../mockApi';
import { grantUserPermissions } from '../../../mocks';
import { KnownProvenance } from '../../../types/knownProvenance';
import { isNotSupported, isProvisioned } from '../abilityUtils';
import { NotificationTemplateAction } from '../types';

import {
  EXTERNAL_AM_VISIBILITY_PERMISSION,
  GRAFANA_AM_VISIBILITY_PERMISSION,
  createAlertmanagerWrapper,
  setupGrafanaAlertmanager,
  setupMimirAlertmanager,
  setupVanillaPrometheusAlertmanager,
} from './abilityTestUtils';
import { useNotificationTemplateAbility } from './useNotificationTemplateAbility';

setupMswServer();

const notProvisionedTemplate = {
  uid: 'x',
  title: 'x',
  content: '',
  provenance: KnownProvenance.None,
  kind: 'grafana' as const,
};

const provisionedTemplate = {
  uid: 'x',
  title: 'x',
  content: '',
  provenance: KnownProvenance.API,
  kind: 'grafana' as const,
};

describe('useNotificationTemplateAbility', () => {
  describe('Grafana alertmanager', () => {
    describe('View', () => {
      it('should grant View when read permission is held', () => {
        const amSource = setupGrafanaAlertmanager();
        grantUserPermissions([GRAFANA_AM_VISIBILITY_PERMISSION]);

        const { result } = renderHook(
          () => useNotificationTemplateAbility({ action: NotificationTemplateAction.View }),
          { wrapper: createAlertmanagerWrapper(amSource) }
        );

        expect(result.current.granted).toBe(true);
      });
    });

    describe('Create', () => {
      it('should deny Create when only read permission is held', () => {
        const amSource = setupGrafanaAlertmanager();
        grantUserPermissions([GRAFANA_AM_VISIBILITY_PERMISSION]);

        const { result } = renderHook(
          () => useNotificationTemplateAbility({ action: NotificationTemplateAction.Create }),
          { wrapper: createAlertmanagerWrapper(amSource) }
        );

        expect(result.current.granted).toBe(false);
      });

      it('should grant Create when write permission is held', () => {
        const amSource = setupGrafanaAlertmanager();
        grantUserPermissions([GRAFANA_AM_VISIBILITY_PERMISSION, AccessControlAction.AlertingNotificationsWrite]);

        const { result } = renderHook(
          () => useNotificationTemplateAbility({ action: NotificationTemplateAction.Create }),
          { wrapper: createAlertmanagerWrapper(amSource) }
        );

        expect(result.current.granted).toBe(true);
      });
    });

    describe('Update', () => {
      it('should grant Update when write permission is held and template is not provisioned', () => {
        const amSource = setupGrafanaAlertmanager();
        grantUserPermissions([GRAFANA_AM_VISIBILITY_PERMISSION, AccessControlAction.AlertingNotificationsWrite]);

        const { result } = renderHook(
          () =>
            useNotificationTemplateAbility({
              action: NotificationTemplateAction.Update,
              context: notProvisionedTemplate,
            }),
          { wrapper: createAlertmanagerWrapper(amSource) }
        );

        expect(result.current.granted).toBe(true);
      });

      it('should return Provisioned for Update when template is provisioned', () => {
        const amSource = setupGrafanaAlertmanager();
        grantUserPermissions([GRAFANA_AM_VISIBILITY_PERMISSION, AccessControlAction.AlertingNotificationsWrite]);

        const { result } = renderHook(
          () =>
            useNotificationTemplateAbility({ action: NotificationTemplateAction.Update, context: provisionedTemplate }),
          { wrapper: createAlertmanagerWrapper(amSource) }
        );

        expect(isProvisioned(result.current)).toBe(true);
      });

      it('should grant Update when context is undefined (no provenance to check)', () => {
        const amSource = setupGrafanaAlertmanager();
        grantUserPermissions([GRAFANA_AM_VISIBILITY_PERMISSION, AccessControlAction.AlertingNotificationsWrite]);

        const { result } = renderHook(
          () => useNotificationTemplateAbility({ action: NotificationTemplateAction.Update }),
          { wrapper: createAlertmanagerWrapper(amSource) }
        );

        expect(result.current.granted).toBe(true);
      });
    });

    describe('Delete', () => {
      it('should grant Delete when write permission is held and template is not provisioned', () => {
        const amSource = setupGrafanaAlertmanager();
        grantUserPermissions([GRAFANA_AM_VISIBILITY_PERMISSION, AccessControlAction.AlertingNotificationsWrite]);

        const { result } = renderHook(
          () =>
            useNotificationTemplateAbility({
              action: NotificationTemplateAction.Delete,
              context: notProvisionedTemplate,
            }),
          { wrapper: createAlertmanagerWrapper(amSource) }
        );

        expect(result.current.granted).toBe(true);
      });

      it('should return Provisioned for Delete when template is provisioned', () => {
        const amSource = setupGrafanaAlertmanager();
        grantUserPermissions([GRAFANA_AM_VISIBILITY_PERMISSION, AccessControlAction.AlertingNotificationsWrite]);

        const { result } = renderHook(
          () =>
            useNotificationTemplateAbility({ action: NotificationTemplateAction.Delete, context: provisionedTemplate }),
          { wrapper: createAlertmanagerWrapper(amSource) }
        );

        expect(isProvisioned(result.current)).toBe(true);
      });
    });

    describe('Test', () => {
      it('should grant Test when template test permission is held and template is not provisioned', () => {
        const amSource = setupGrafanaAlertmanager();
        grantUserPermissions([
          GRAFANA_AM_VISIBILITY_PERMISSION,
          AccessControlAction.AlertingNotificationsTemplatesTest,
        ]);

        const { result } = renderHook(
          () =>
            useNotificationTemplateAbility({
              action: NotificationTemplateAction.Test,
              context: notProvisionedTemplate,
            }),
          { wrapper: createAlertmanagerWrapper(amSource) }
        );

        expect(result.current.granted).toBe(true);
      });

      it('should return Provisioned for Test when template is provisioned', () => {
        const amSource = setupGrafanaAlertmanager();
        grantUserPermissions([
          GRAFANA_AM_VISIBILITY_PERMISSION,
          AccessControlAction.AlertingNotificationsTemplatesTest,
        ]);

        const { result } = renderHook(
          () =>
            useNotificationTemplateAbility({ action: NotificationTemplateAction.Test, context: provisionedTemplate }),
          { wrapper: createAlertmanagerWrapper(amSource) }
        );

        expect(isProvisioned(result.current)).toBe(true);
      });

      it('should grant Test when context is undefined (no provenance to check)', () => {
        const amSource = setupGrafanaAlertmanager();
        grantUserPermissions([
          GRAFANA_AM_VISIBILITY_PERMISSION,
          AccessControlAction.AlertingNotificationsTemplatesTest,
        ]);

        const { result } = renderHook(
          () => useNotificationTemplateAbility({ action: NotificationTemplateAction.Test }),
          { wrapper: createAlertmanagerWrapper(amSource) }
        );

        expect(result.current.granted).toBe(true);
      });

      it('should deny Test when permission is not held', () => {
        const amSource = setupGrafanaAlertmanager();
        grantUserPermissions([GRAFANA_AM_VISIBILITY_PERMISSION]);

        const { result } = renderHook(
          () => useNotificationTemplateAbility({ action: NotificationTemplateAction.Test }),
          { wrapper: createAlertmanagerWrapper(amSource) }
        );

        expect(result.current.granted).toBe(false);
      });
    });
  });

  describe('vanilla Prometheus alertmanager', () => {
    it('should return NotSupported for all actions — no configuration API available', () => {
      const amSource = setupVanillaPrometheusAlertmanager();
      grantUserPermissions([]);

      const { result } = renderHook(
        () => ({
          view: useNotificationTemplateAbility({ action: NotificationTemplateAction.View }),
          create: useNotificationTemplateAbility({ action: NotificationTemplateAction.Create }),
          update: useNotificationTemplateAbility({ action: NotificationTemplateAction.Update }),
          delete: useNotificationTemplateAbility({ action: NotificationTemplateAction.Delete }),
          test: useNotificationTemplateAbility({ action: NotificationTemplateAction.Test }),
        }),
        { wrapper: createAlertmanagerWrapper(amSource) }
      );

      expect(isNotSupported(result.current.view)).toBe(true);
      expect(isNotSupported(result.current.create)).toBe(true);
      expect(isNotSupported(result.current.update)).toBe(true);
      expect(isNotSupported(result.current.delete)).toBe(true);
      expect(isNotSupported(result.current.test)).toBe(true);
    });
  });

  describe('external (Mimir) alertmanager', () => {
    it('should deny View and Create and list the expected required permissions', () => {
      // The template hooks only check Grafana-AM-specific permissions, so external
      // permissions are never sufficient. The snapshot captures the anyOfPermissions list.
      setupMimirAlertmanager(MIMIR_DATASOURCE_UID);
      grantUserPermissions([
        EXTERNAL_AM_VISIBILITY_PERMISSION,
        AccessControlAction.AlertingNotificationsExternalRead,
        AccessControlAction.AlertingNotificationsExternalWrite,
      ]);

      const { result } = renderHook(
        () => ({
          view: useNotificationTemplateAbility({ action: NotificationTemplateAction.View }),
          create: useNotificationTemplateAbility({ action: NotificationTemplateAction.Create }),
        }),
        { wrapper: createAlertmanagerWrapper(MIMIR_DATASOURCE_UID) }
      );

      expect(result.current.view.granted).toBe(false);
      expect(result.current.create.granted).toBe(false);
      expect(result.current).toMatchSnapshot();
    });
  });
});
