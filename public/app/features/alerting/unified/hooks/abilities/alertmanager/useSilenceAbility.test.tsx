import { renderHook } from 'test/test-utils';

import { MIMIR_DATASOURCE_UID } from 'app/features/alerting/unified/mocks/server/constants';
import { AccessControlAction } from 'app/types/accessControl';

import { setupMswServer } from '../../../mockApi';
import { grantUserPermissions } from '../../../mocks';
import { isLoading } from '../abilityUtils';
import { SilenceAction } from '../types';

import {
  EXTERNAL_AM_VISIBILITY_PERMISSION,
  GRAFANA_AM_VISIBILITY_PERMISSION,
  createAlertmanagerWrapper,
  setupGrafanaAlertmanager,
  setupMimirAlertmanager,
  setupVanillaPrometheusAlertmanager,
} from './abilityTestUtils';
import { useSilenceAbility } from './useSilenceAbility';

setupMswServer();

describe('useSilenceAbility', () => {
  describe('Grafana alertmanager', () => {
    it('should grant Create when AlertingInstanceCreate is held', () => {
      const amSource = setupGrafanaAlertmanager();
      grantUserPermissions([GRAFANA_AM_VISIBILITY_PERMISSION, AccessControlAction.AlertingInstanceCreate]);

      const { result } = renderHook(() => useSilenceAbility({ action: SilenceAction.Create }), {
        wrapper: createAlertmanagerWrapper(amSource),
      });

      expect(result.current.granted).toBe(true);
    });

    it('should deny Create when only the external write permission is held', () => {
      const amSource = setupGrafanaAlertmanager();
      grantUserPermissions([GRAFANA_AM_VISIBILITY_PERMISSION, AccessControlAction.AlertingInstancesExternalWrite]);

      const { result } = renderHook(() => useSilenceAbility({ action: SilenceAction.Create }), {
        wrapper: createAlertmanagerWrapper(amSource),
      });

      expect(result.current.granted).toBe(false);
    });

    it('should grant View and Preview when AlertingInstanceRead is held', () => {
      const amSource = setupGrafanaAlertmanager();
      grantUserPermissions([GRAFANA_AM_VISIBILITY_PERMISSION, AccessControlAction.AlertingInstanceRead]);

      const { result } = renderHook(
        () => ({
          view: useSilenceAbility({ action: SilenceAction.View }),
          preview: useSilenceAbility({ action: SilenceAction.Preview }),
        }),
        { wrapper: createAlertmanagerWrapper(amSource) }
      );

      expect(result.current.view.granted).toBe(true);
      expect(result.current.preview.granted).toBe(true);
    });

    it('should deny Update when accessControl.write is false on the silence entity', () => {
      const amSource = setupGrafanaAlertmanager();
      grantUserPermissions([GRAFANA_AM_VISIBILITY_PERMISSION, AccessControlAction.AlertingInstanceUpdate]);

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
  });

  describe('external (Mimir) alertmanager', () => {
    it('should grant Create when AlertingInstancesExternalWrite is held', () => {
      setupMimirAlertmanager(MIMIR_DATASOURCE_UID);
      grantUserPermissions([EXTERNAL_AM_VISIBILITY_PERMISSION, AccessControlAction.AlertingInstancesExternalWrite]);

      const { result } = renderHook(() => useSilenceAbility({ action: SilenceAction.Create }), {
        wrapper: createAlertmanagerWrapper(MIMIR_DATASOURCE_UID),
      });

      expect(result.current.granted).toBe(true);
    });

    it('should deny Create when only the Grafana AM create permission is held', () => {
      setupMimirAlertmanager(MIMIR_DATASOURCE_UID);
      grantUserPermissions([EXTERNAL_AM_VISIBILITY_PERMISSION, AccessControlAction.AlertingInstanceCreate]);

      const { result } = renderHook(() => useSilenceAbility({ action: SilenceAction.Create }), {
        wrapper: createAlertmanagerWrapper(MIMIR_DATASOURCE_UID),
      });

      expect(result.current.granted).toBe(false);
    });
  });

  describe('unresolved alertmanager (selectedAlertmanager is undefined)', () => {
    it('should return Loading for Create when no AM resolves in context', () => {
      // setupVanillaPrometheusAlertmanager returns 'does-not-exist' as the source name,
      // which won't match any available AM. Grant no permissions so neither the
      // Grafana AM nor any external AM appears in availableAlertManagers, ensuring
      // selectedAlertmanager stays undefined in AlertmanagerContext.
      const amSource = setupVanillaPrometheusAlertmanager();
      grantUserPermissions([]);

      const { result } = renderHook(() => useSilenceAbility({ action: SilenceAction.Create }), {
        wrapper: createAlertmanagerWrapper(amSource),
      });

      expect(isLoading(result.current)).toBe(true);
    });
  });
});
