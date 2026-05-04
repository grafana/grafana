import { renderHook } from 'test/test-utils';

import { MIMIR_DATASOURCE_UID } from 'app/features/alerting/unified/mocks/server/constants';
import { AccessControlAction } from 'app/types/accessControl';

import { setupMswServer } from '../../../mockApi';
import { grantUserPermissions } from '../../../mocks';
import { isNotSupported, isProvisioned } from '../abilityUtils';
import { TimeIntervalAction } from '../types';

import {
  EXTERNAL_AM_VISIBILITY_PERMISSION,
  GRAFANA_AM_VISIBILITY_PERMISSION,
  createAlertmanagerWrapper,
  setupGrafanaAlertmanager,
  setupMimirAlertmanager,
  setupVanillaPrometheusAlertmanager,
} from './abilityTestUtils';
import { useGlobalTimeIntervalAbility, useTimeIntervalAbility } from './useTimeIntervalAbility';

setupMswServer();

const notProvisioned = { provisioned: false };
const provisioned = { provisioned: true };

describe('useGlobalTimeIntervalAbility', () => {
  it('grants View when read permission is held — no alertmanager context needed', () => {
    grantUserPermissions([GRAFANA_AM_VISIBILITY_PERMISSION]);

    const { result } = renderHook(() => useGlobalTimeIntervalAbility(TimeIntervalAction.View));

    expect(result.current.granted).toBe(true);
  });

  it('denies View when no read permission is held', () => {
    grantUserPermissions([]);

    const { result } = renderHook(() => useGlobalTimeIntervalAbility(TimeIntervalAction.View));

    expect(result.current.granted).toBe(false);
  });

  it('grants Create when write permission is held', () => {
    grantUserPermissions([AccessControlAction.AlertingTimeIntervalsWrite]);

    const { result } = renderHook(() => useGlobalTimeIntervalAbility(TimeIntervalAction.Create));

    expect(result.current.granted).toBe(true);
  });

  it('grants Export when read permission is held', () => {
    grantUserPermissions([GRAFANA_AM_VISIBILITY_PERMISSION]);

    const { result } = renderHook(() => useGlobalTimeIntervalAbility(TimeIntervalAction.Export));

    expect(result.current.granted).toBe(true);
  });
});

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

    it('should grant Update and Delete when the matching fine-grained permissions are held and interval is not provisioned', () => {
      const amSource = setupGrafanaAlertmanager();
      grantUserPermissions([
        GRAFANA_AM_VISIBILITY_PERMISSION,
        AccessControlAction.AlertingTimeIntervalsWrite,
        AccessControlAction.AlertingTimeIntervalsDelete,
      ]);

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

    it('should NOT grant Delete when only write permission is held (backend separates :write from :delete)', () => {
      const amSource = setupGrafanaAlertmanager();
      grantUserPermissions([GRAFANA_AM_VISIBILITY_PERMISSION, AccessControlAction.AlertingTimeIntervalsWrite]);

      const { result } = renderHook(
        () => useTimeIntervalAbility({ action: TimeIntervalAction.Delete, context: notProvisioned as never }),
        { wrapper: createAlertmanagerWrapper(amSource) }
      );

      expect(result.current.granted).toBe(false);
    });

    it('should return Provisioned for Update and Delete when interval is provisioned', () => {
      const amSource = setupGrafanaAlertmanager();
      grantUserPermissions([
        GRAFANA_AM_VISIBILITY_PERMISSION,
        AccessControlAction.AlertingTimeIntervalsWrite,
        AccessControlAction.AlertingTimeIntervalsDelete,
      ]);

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
      grantUserPermissions([
        GRAFANA_AM_VISIBILITY_PERMISSION,
        AccessControlAction.AlertingTimeIntervalsWrite,
        AccessControlAction.AlertingTimeIntervalsDelete,
      ]);

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
    it('should return NotSupported for all actions — no configuration API available', () => {
      const amSource = setupVanillaPrometheusAlertmanager();
      grantUserPermissions([]);

      const { result } = renderHook(
        () => ({
          view: useTimeIntervalAbility({ action: TimeIntervalAction.View }),
          create: useTimeIntervalAbility({ action: TimeIntervalAction.Create }),
          export: useTimeIntervalAbility({ action: TimeIntervalAction.Export }),
          update: useTimeIntervalAbility({ action: TimeIntervalAction.Update }),
          delete: useTimeIntervalAbility({ action: TimeIntervalAction.Delete }),
        }),
        { wrapper: createAlertmanagerWrapper(amSource) }
      );

      expect(isNotSupported(result.current.view)).toBe(true);
      expect(isNotSupported(result.current.create)).toBe(true);
      expect(isNotSupported(result.current.export)).toBe(true);
      expect(isNotSupported(result.current.update)).toBe(true);
      expect(isNotSupported(result.current.delete)).toBe(true);
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
