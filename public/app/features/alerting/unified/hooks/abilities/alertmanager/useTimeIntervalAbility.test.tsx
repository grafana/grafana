import { renderHook } from 'test/test-utils';

import { MIMIR_DATASOURCE_UID } from 'app/features/alerting/unified/mocks/server/constants';
import { AccessControlAction } from 'app/types/accessControl';

import { setupMswServer } from '../../../mockApi';
import { grantUserPermissions } from '../../../mocks';
import { isProvisioned } from '../abilityUtils';
import { TimeIntervalAction } from '../types';

import {
  EXTERNAL_AM_VISIBILITY_PERMISSION,
  GRAFANA_AM_VISIBILITY_PERMISSION,
  createAlertmanagerWrapper,
  setupGrafanaAlertmanager,
  setupMimirAlertmanager,
  setupVanillaPrometheusAlertmanager,
} from './abilityTestUtils';
import { useTimeIntervalAbility } from './useTimeIntervalAbility';

setupMswServer();

const notProvisioned = { provisioned: false };
const provisioned = { provisioned: true };

describe('useTimeIntervalAbility', () => {
  describe('Grafana alertmanager', () => {
    it('should grant View and Export when read permission is held', () => {
      const amSource = setupGrafanaAlertmanager();
      grantUserPermissions([GRAFANA_AM_VISIBILITY_PERMISSION]);

      const { result } = renderHook(
        () => ({
          view: useTimeIntervalAbility({ action: TimeIntervalAction.View }),
          export: useTimeIntervalAbility({ action: TimeIntervalAction.Export }),
        }),
        { wrapper: createAlertmanagerWrapper(amSource) }
      );

      expect(result.current.view.granted).toBe(true);
      expect(result.current.export.granted).toBe(true);
    });

    it('should deny Create when only read permission is held', () => {
      const amSource = setupGrafanaAlertmanager();
      grantUserPermissions([GRAFANA_AM_VISIBILITY_PERMISSION]);

      const { result } = renderHook(() => useTimeIntervalAbility({ action: TimeIntervalAction.Create }), {
        wrapper: createAlertmanagerWrapper(amSource),
      });

      expect(result.current.granted).toBe(false);
    });

    it('should grant Create when write permission is held', () => {
      const amSource = setupGrafanaAlertmanager();
      grantUserPermissions([GRAFANA_AM_VISIBILITY_PERMISSION, AccessControlAction.AlertingTimeIntervalsWrite]);

      const { result } = renderHook(() => useTimeIntervalAbility({ action: TimeIntervalAction.Create }), {
        wrapper: createAlertmanagerWrapper(amSource),
      });

      expect(result.current.granted).toBe(true);
    });

    it('should grant Update and Delete when write permission is held and interval is not provisioned', () => {
      const amSource = setupGrafanaAlertmanager();
      grantUserPermissions([GRAFANA_AM_VISIBILITY_PERMISSION, AccessControlAction.AlertingTimeIntervalsWrite]);

      const { result } = renderHook(
        () => ({
          update: useTimeIntervalAbility({ action: TimeIntervalAction.Update, context: notProvisioned as never }),
          delete: useTimeIntervalAbility({ action: TimeIntervalAction.Delete, context: notProvisioned as never }),
        }),
        { wrapper: createAlertmanagerWrapper(amSource) }
      );

      expect(result.current.update.granted).toBe(true);
      expect(result.current.delete.granted).toBe(true);
    });

    it('should return Provisioned for Update and Delete when interval is provisioned', () => {
      const amSource = setupGrafanaAlertmanager();
      grantUserPermissions([GRAFANA_AM_VISIBILITY_PERMISSION, AccessControlAction.AlertingTimeIntervalsWrite]);

      const { result } = renderHook(
        () => ({
          update: useTimeIntervalAbility({ action: TimeIntervalAction.Update, context: provisioned as never }),
          delete: useTimeIntervalAbility({ action: TimeIntervalAction.Delete, context: provisioned as never }),
        }),
        { wrapper: createAlertmanagerWrapper(amSource) }
      );

      expect(isProvisioned(result.current.update)).toBe(true);
      expect(isProvisioned(result.current.delete)).toBe(true);
    });

    it('should grant Update and Delete when context is undefined (no provenance to check)', () => {
      const amSource = setupGrafanaAlertmanager();
      grantUserPermissions([GRAFANA_AM_VISIBILITY_PERMISSION, AccessControlAction.AlertingTimeIntervalsWrite]);

      const { result } = renderHook(
        () => ({
          update: useTimeIntervalAbility({ action: TimeIntervalAction.Update }),
          delete: useTimeIntervalAbility({ action: TimeIntervalAction.Delete }),
        }),
        { wrapper: createAlertmanagerWrapper(amSource) }
      );

      expect(result.current.update.granted).toBe(true);
      expect(result.current.delete.granted).toBe(true);
    });
  });

  describe('vanilla Prometheus alertmanager', () => {
    it('should deny Create / Update / Delete and list the expected required permissions', () => {
      // The snapshot captures the anyOfPermissions list shown in the UI tooltip.
      const amSource = setupVanillaPrometheusAlertmanager();
      grantUserPermissions([]);

      const { result } = renderHook(
        () => ({
          create: useTimeIntervalAbility({ action: TimeIntervalAction.Create }),
          update: useTimeIntervalAbility({ action: TimeIntervalAction.Update }),
          delete: useTimeIntervalAbility({ action: TimeIntervalAction.Delete }),
        }),
        { wrapper: createAlertmanagerWrapper(amSource) }
      );

      expect(result.current.create.granted).toBe(false);
      expect(result.current.update.granted).toBe(false);
      expect(result.current.delete.granted).toBe(false);
      expect(result.current).toMatchSnapshot();
    });
  });

  describe('external (Mimir) alertmanager', () => {
    it('should deny View and Create and list the expected required permissions', () => {
      // The time interval hooks only check Grafana-AM-specific permissions, so external
      // permissions are never sufficient. The snapshot captures the anyOfPermissions list.
      setupMimirAlertmanager(MIMIR_DATASOURCE_UID);
      grantUserPermissions([
        EXTERNAL_AM_VISIBILITY_PERMISSION,
        AccessControlAction.AlertingNotificationsExternalRead,
        AccessControlAction.AlertingNotificationsExternalWrite,
      ]);

      const { result } = renderHook(
        () => ({
          view: useTimeIntervalAbility({ action: TimeIntervalAction.View }),
          create: useTimeIntervalAbility({ action: TimeIntervalAction.Create }),
        }),
        { wrapper: createAlertmanagerWrapper(MIMIR_DATASOURCE_UID) }
      );

      expect(result.current.view.granted).toBe(false);
      expect(result.current.create.granted).toBe(false);
      expect(result.current).toMatchSnapshot();
    });
  });
});
