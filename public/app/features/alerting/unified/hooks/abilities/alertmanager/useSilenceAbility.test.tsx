import { renderHook } from 'test/test-utils';

import { AccessControlAction } from 'app/types/accessControl';

import { setupMswServer } from '../../../mockApi';
import { grantUserPermissions } from '../../../mocks';
import { isLoading } from '../abilityUtils';
import { SilenceAction } from '../types';

import {
  EXTERNAL_AM_VISIBILITY_PERMISSION,
  GRAFANA_AM_VISIBILITY_PERMISSION,
  UNRESOLVED_ALERTMANAGER_SOURCE,
  createAlertmanagerWrapper,
  setupGrafanaAlertmanager,
  setupMimirAlertmanager,
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

    it('should grant View and Preview when only AlertingSilenceRead is held', () => {
      const amSource = setupGrafanaAlertmanager();
      grantUserPermissions([GRAFANA_AM_VISIBILITY_PERMISSION, AccessControlAction.AlertingSilenceRead]);

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

    it('should grant Update when only AlertingSilenceUpdate is held', () => {
      const amSource = setupGrafanaAlertmanager();
      grantUserPermissions([GRAFANA_AM_VISIBILITY_PERMISSION, AccessControlAction.AlertingSilenceUpdate]);

      const { result } = renderHook(() => useSilenceAbility({ action: SilenceAction.Update }), {
        wrapper: createAlertmanagerWrapper(amSource),
      });

      expect(result.current.granted).toBe(true);
    });

    it('should grant Create when only AlertingSilenceCreate is held', () => {
      const amSource = setupGrafanaAlertmanager();
      grantUserPermissions([GRAFANA_AM_VISIBILITY_PERMISSION, AccessControlAction.AlertingSilenceCreate]);

      const { result } = renderHook(() => useSilenceAbility({ action: SilenceAction.Create }), {
        wrapper: createAlertmanagerWrapper(amSource),
      });

      expect(result.current.granted).toBe(true);
    });
  });

  describe('external (Mimir) alertmanager', () => {
    it('should grant Create when AlertingInstancesExternalWrite is held', () => {
      const amSource = setupMimirAlertmanager();
      grantUserPermissions([EXTERNAL_AM_VISIBILITY_PERMISSION, AccessControlAction.AlertingInstancesExternalWrite]);

      const { result } = renderHook(() => useSilenceAbility({ action: SilenceAction.Create }), {
        wrapper: createAlertmanagerWrapper(amSource),
      });

      expect(result.current.granted).toBe(true);
    });

    it('should deny Create when only the Grafana AM create permission is held', () => {
      const amSource = setupMimirAlertmanager();
      grantUserPermissions([EXTERNAL_AM_VISIBILITY_PERMISSION, AccessControlAction.AlertingInstanceCreate]);

      const { result } = renderHook(() => useSilenceAbility({ action: SilenceAction.Create }), {
        wrapper: createAlertmanagerWrapper(amSource),
      });

      expect(result.current.granted).toBe(false);
    });

    it('should grant View and Preview when AlertingInstancesExternalRead is held', () => {
      const amSource = setupMimirAlertmanager();
      grantUserPermissions([EXTERNAL_AM_VISIBILITY_PERMISSION, AccessControlAction.AlertingInstancesExternalRead]);

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

    it('should deny View and Preview when only the Grafana AM read permission is held', () => {
      const amSource = setupMimirAlertmanager();
      grantUserPermissions([EXTERNAL_AM_VISIBILITY_PERMISSION, AccessControlAction.AlertingInstanceRead]);

      const { result } = renderHook(
        () => ({
          view: useSilenceAbility({ action: SilenceAction.View }),
          preview: useSilenceAbility({ action: SilenceAction.Preview }),
        }),
        { wrapper: createAlertmanagerWrapper(amSource) }
      );

      expect(result.current.view.granted).toBe(false);
      expect(result.current.preview.granted).toBe(false);
    });

    it('should grant Update when AlertingInstancesExternalWrite is held', () => {
      const amSource = setupMimirAlertmanager();
      grantUserPermissions([EXTERNAL_AM_VISIBILITY_PERMISSION, AccessControlAction.AlertingInstancesExternalWrite]);

      const { result } = renderHook(() => useSilenceAbility({ action: SilenceAction.Update }), {
        wrapper: createAlertmanagerWrapper(amSource),
      });

      expect(result.current.granted).toBe(true);
    });

    it('should deny Update when only the Grafana AM update permission is held', () => {
      const amSource = setupMimirAlertmanager();
      grantUserPermissions([EXTERNAL_AM_VISIBILITY_PERMISSION, AccessControlAction.AlertingInstanceUpdate]);

      const { result } = renderHook(() => useSilenceAbility({ action: SilenceAction.Update }), {
        wrapper: createAlertmanagerWrapper(amSource),
      });

      expect(result.current.granted).toBe(false);
    });

    it('should deny Update when accessControl.write is false on the silence entity', () => {
      const amSource = setupMimirAlertmanager();
      grantUserPermissions([EXTERNAL_AM_VISIBILITY_PERMISSION, AccessControlAction.AlertingInstancesExternalWrite]);

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

  describe('unresolved alertmanager (selectedAlertmanager is undefined)', () => {
    it('should return Loading for Create when no AM resolves in context', () => {
      // Grant no permissions so neither the Grafana AM nor any external AM appears in
      // availableAlertManagers, ensuring selectedAlertmanager stays undefined in AlertmanagerContext.
      grantUserPermissions([]);

      const { result } = renderHook(() => useSilenceAbility({ action: SilenceAction.Create }), {
        wrapper: createAlertmanagerWrapper(UNRESOLVED_ALERTMANAGER_SOURCE),
      });

      expect(isLoading(result.current)).toBe(true);
    });

    it('should return Loading for View, Preview, and Update when no AM resolves in context', () => {
      grantUserPermissions([]);

      const { result } = renderHook(
        () => ({
          view: useSilenceAbility({ action: SilenceAction.View }),
          preview: useSilenceAbility({ action: SilenceAction.Preview }),
          update: useSilenceAbility({ action: SilenceAction.Update }),
        }),
        { wrapper: createAlertmanagerWrapper(UNRESOLVED_ALERTMANAGER_SOURCE) }
      );

      expect(isLoading(result.current.view)).toBe(true);
      expect(isLoading(result.current.preview)).toBe(true);
      expect(isLoading(result.current.update)).toBe(true);
    });
  });
});
