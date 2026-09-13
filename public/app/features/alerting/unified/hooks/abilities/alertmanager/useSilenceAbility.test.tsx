import { getWrapper, renderHook, waitFor } from 'test/test-utils';

import { AccessControlAction } from 'app/types/accessControl';

import { setupMswServer } from '../../../mockApi';
import { grantUserPermissions } from '../../../mocks';
import { setFolderAccessControl } from '../../../mocks/server/configure';
import { useFolder } from '../../useFolder';
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
import { useGlobalSilenceAbility, useSilenceAbility } from './useSilenceAbility';

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

    // AlertingSilenceCreate is always granted on folders, and the backend only accepts it for a
    // silence that targets a single rule. Without a folderUID the silence is not tied to a rule,
    // so holding it somewhere must not grant Create.
    it('should deny Create when only AlertingSilenceCreate is held and no folderUID is given', () => {
      const amSource = setupGrafanaAlertmanager();
      grantUserPermissions([GRAFANA_AM_VISIBILITY_PERMISSION, AccessControlAction.AlertingSilenceCreate]);
      setFolderAccessControl({ [AccessControlAction.AlertingSilenceCreate]: true });

      const { result } = renderHook(() => useSilenceAbility({ action: SilenceAction.Create }), {
        wrapper: createAlertmanagerWrapper(amSource),
      });

      expect(result.current.granted).toBe(false);
    });

    // With a folderUID the silence targets a rule in that folder, which is what the backend
    // accepts folder-level AlertingSilenceCreate for.
    it('should grant Create when the rule folder allows AlertingSilenceCreate', async () => {
      const amSource = setupGrafanaAlertmanager();
      grantUserPermissions([GRAFANA_AM_VISIBILITY_PERMISSION]);
      setFolderAccessControl({ [AccessControlAction.AlertingSilenceCreate]: true });

      const { result } = renderHook(
        () => useSilenceAbility({ action: SilenceAction.Create, folderUID: 'NAMESPACE_UID' }),
        { wrapper: createAlertmanagerWrapper(amSource) }
      );

      await waitFor(() => expect(result.current.granted).toBe(true));
    });

    it('should deny Create when the rule folder does not allow AlertingSilenceCreate', async () => {
      const amSource = setupGrafanaAlertmanager();
      grantUserPermissions([GRAFANA_AM_VISIBILITY_PERMISSION]);
      setFolderAccessControl({ [AccessControlAction.AlertingSilenceRead]: true });

      const { result } = renderHook(
        () => ({
          folder: useFolder('NAMESPACE_UID').folder,
          ability: useSilenceAbility({ action: SilenceAction.Create, folderUID: 'NAMESPACE_UID' }),
        }),
        { wrapper: createAlertmanagerWrapper(amSource) }
      );

      // Wait for the folder to arrive first - otherwise "denied" would pass while the check is
      // still holding at Loading.
      await waitFor(() => expect(result.current.folder).toBeDefined());
      expect(isLoading(result.current.ability)).toBe(false);
      expect(result.current.ability.granted).toBe(false);
    });

    // Denying before the folder arrives would hide a button the user is in fact allowed to use.
    it('should report Loading while the rule folder is still resolving', () => {
      const amSource = setupGrafanaAlertmanager();
      grantUserPermissions([GRAFANA_AM_VISIBILITY_PERMISSION]);
      setFolderAccessControl({ [AccessControlAction.AlertingSilenceCreate]: true });

      const { result } = renderHook(
        () => useSilenceAbility({ action: SilenceAction.Create, folderUID: 'NAMESPACE_UID' }),
        { wrapper: createAlertmanagerWrapper(amSource) }
      );

      expect(isLoading(result.current)).toBe(true);
    });

    // Someone with the org-wide permission can silence any rule, so there is nothing to wait for.
    it('should grant Create without waiting for the folder when AlertingInstanceCreate is held', () => {
      const amSource = setupGrafanaAlertmanager();
      grantUserPermissions([GRAFANA_AM_VISIBILITY_PERMISSION, AccessControlAction.AlertingInstanceCreate]);

      const { result } = renderHook(
        () => useSilenceAbility({ action: SilenceAction.Create, folderUID: 'NAMESPACE_UID' }),
        { wrapper: createAlertmanagerWrapper(amSource) }
      );

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

    // Grafana folders say nothing about who may silence in an external alertmanager, so a
    // folderUID must not open the door here - and must not park the check at Loading either.
    it('should ignore the rule folder and not wait for it', () => {
      const amSource = setupMimirAlertmanager();
      grantUserPermissions([EXTERNAL_AM_VISIBILITY_PERMISSION]);
      setFolderAccessControl({ [AccessControlAction.AlertingSilenceCreate]: true });

      const { result } = renderHook(
        () => useSilenceAbility({ action: SilenceAction.Create, folderUID: 'NAMESPACE_UID' }),
        { wrapper: createAlertmanagerWrapper(amSource) }
      );

      expect(isLoading(result.current)).toBe(false);
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

describe('useGlobalSilenceAbility', () => {
  // This hook reads folder access control through the store, so it needs the app providers
  // even though it does no alertmanager-type gating. Build a fresh one per test so a folder
  // fetched by one test isn't served from the query cache in the next.
  let wrapper: ReturnType<typeof getWrapper>;
  beforeEach(() => {
    wrapper = getWrapper({ renderWithRouter: true });
  });

  // Mirrors the backend split: a silence with no rule attached needs the org-wide
  // alert.instances:create, while a silence for a rule in a folder can also be created with
  // alert.silences:create on that folder.
  describe('silence that is not tied to a rule (no folderUID)', () => {
    it('should grant Create when AlertingInstanceCreate is held', () => {
      grantUserPermissions([AccessControlAction.AlertingInstanceCreate]);

      const { result } = renderHook(() => useGlobalSilenceAbility({ action: SilenceAction.Create }), { wrapper });

      expect(result.current.granted).toBe(true);
    });

    it('should deny Create when only AlertingSilenceCreate is held', () => {
      grantUserPermissions([AccessControlAction.AlertingSilenceCreate]);

      const { result } = renderHook(() => useGlobalSilenceAbility({ action: SilenceAction.Create }), { wrapper });

      expect(result.current.granted).toBe(false);
    });
  });

  describe('silence for a rule in a folder', () => {
    it('should grant Create when the folder allows AlertingSilenceCreate', async () => {
      grantUserPermissions([]);
      setFolderAccessControl({ [AccessControlAction.AlertingSilenceCreate]: true });

      const { result } = renderHook(
        () => useGlobalSilenceAbility({ action: SilenceAction.Create, folderUID: 'NAMESPACE_UID' }),
        { wrapper }
      );

      await waitFor(() => expect(result.current.granted).toBe(true));
    });

    it('should deny Create when the folder does not allow AlertingSilenceCreate', async () => {
      grantUserPermissions([]);
      setFolderAccessControl({ [AccessControlAction.AlertingSilenceRead]: true });

      const { result } = renderHook(
        () => ({
          folder: useFolder('NAMESPACE_UID').folder,
          ability: useGlobalSilenceAbility({ action: SilenceAction.Create, folderUID: 'NAMESPACE_UID' }),
        }),
        { wrapper }
      );

      // Wait for the folder to arrive first - otherwise "denied" would pass before the check
      // has had any access control to look at.
      await waitFor(() => expect(result.current.folder).toBeDefined());
      expect(result.current.ability.granted).toBe(false);
    });
  });
});
