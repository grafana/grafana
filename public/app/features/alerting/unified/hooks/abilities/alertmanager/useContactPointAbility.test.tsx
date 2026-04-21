import { renderHook } from 'test/test-utils';

import { MIMIR_DATASOURCE_UID } from 'app/features/alerting/unified/mocks/server/constants';
import { AccessControlAction } from 'app/types/accessControl';

import { setupMswServer } from '../../../mockApi';
import { grantUserPermissions } from '../../../mocks';
import { K8sAnnotations } from '../../../utils/k8s/constants';
import { isProvisioned } from '../abilityUtils';
import { ContactPointAction, isInsufficientPermissions } from '../types';

import {
  EXTERNAL_AM_VISIBILITY_PERMISSION,
  GRAFANA_AM_VISIBILITY_PERMISSION,
  createAlertmanagerWrapper,
  setupGrafanaAlertmanager,
  setupMimirAlertmanager,
  setupVanillaPrometheusAlertmanager,
} from './abilityTestUtils';
import { useContactPointAbility } from './useContactPointAbility';

setupMswServer();

/** A k8s entity with full write/delete access and no provenance (not provisioned). */
const editableEntity = {
  metadata: {
    annotations: {
      [K8sAnnotations.AccessWrite]: 'true',
      [K8sAnnotations.AccessDelete]: 'true',
    },
  },
};

/** A k8s entity with provenance set — provisioned via the API. */
const provisionedEntity = {
  metadata: {
    annotations: {
      [K8sAnnotations.Provenance]: 'api',
      [K8sAnnotations.AccessWrite]: 'true',
      [K8sAnnotations.AccessDelete]: 'true',
    },
  },
};

/** A k8s entity where the server has denied write/delete access via annotations. */
const readOnlyEntity = {
  metadata: {
    annotations: {
      [K8sAnnotations.AccessWrite]: 'false',
      [K8sAnnotations.AccessDelete]: 'false',
    },
  },
};

describe('useContactPointAbility', () => {
  describe('Grafana alertmanager', () => {
    describe('View / BulkExport', () => {
      it('should grant View and BulkExport when notifications read permission is held', () => {
        const amSource = setupGrafanaAlertmanager();
        grantUserPermissions([GRAFANA_AM_VISIBILITY_PERMISSION]);

        const { result } = renderHook(
          () => ({
            view: useContactPointAbility({ action: ContactPointAction.View }),
            bulkExport: useContactPointAbility({ action: ContactPointAction.BulkExport }),
          }),
          { wrapper: createAlertmanagerWrapper(amSource) }
        );

        expect(result.current.view.granted).toBe(true);
        expect(result.current.bulkExport.granted).toBe(true);
      });

      it('should deny View when no read permission is held', () => {
        const amSource = setupGrafanaAlertmanager();
        grantUserPermissions([]);

        const { result } = renderHook(() => useContactPointAbility({ action: ContactPointAction.View }), {
          wrapper: createAlertmanagerWrapper(amSource),
        });

        expect(result.current.granted).toBe(false);
        expect(isInsufficientPermissions(result.current)).toBe(true);
      });
    });

    describe('Create', () => {
      it('should deny Create when only read permission is held', () => {
        const amSource = setupGrafanaAlertmanager();
        grantUserPermissions([GRAFANA_AM_VISIBILITY_PERMISSION]);

        const { result } = renderHook(() => useContactPointAbility({ action: ContactPointAction.Create }), {
          wrapper: createAlertmanagerWrapper(amSource),
        });

        expect(result.current.granted).toBe(false);
        expect(isInsufficientPermissions(result.current)).toBe(true);
      });

      it('should grant Create when receivers create permission is held', () => {
        const amSource = setupGrafanaAlertmanager();
        grantUserPermissions([GRAFANA_AM_VISIBILITY_PERMISSION, AccessControlAction.AlertingReceiversCreate]);

        const { result } = renderHook(() => useContactPointAbility({ action: ContactPointAction.Create }), {
          wrapper: createAlertmanagerWrapper(amSource),
        });

        expect(result.current.granted).toBe(true);
      });
    });

    describe('Update', () => {
      it('should grant Update when write permission is held and entity is editable', () => {
        const amSource = setupGrafanaAlertmanager();
        grantUserPermissions([GRAFANA_AM_VISIBILITY_PERMISSION, AccessControlAction.AlertingReceiversWrite]);

        const { result } = renderHook(
          () => useContactPointAbility({ action: ContactPointAction.Update, context: editableEntity }),
          { wrapper: createAlertmanagerWrapper(amSource) }
        );

        expect(result.current.granted).toBe(true);
      });

      it('should return Provisioned for Update when entity is provisioned', () => {
        const amSource = setupGrafanaAlertmanager();
        grantUserPermissions([GRAFANA_AM_VISIBILITY_PERMISSION, AccessControlAction.AlertingReceiversWrite]);

        const { result } = renderHook(
          () => useContactPointAbility({ action: ContactPointAction.Update, context: provisionedEntity }),
          { wrapper: createAlertmanagerWrapper(amSource) }
        );

        expect(isProvisioned(result.current)).toBe(true);
      });

      it('should return InsufficientPermissions for Update when canWrite annotation is false', () => {
        const amSource = setupGrafanaAlertmanager();
        grantUserPermissions([GRAFANA_AM_VISIBILITY_PERMISSION, AccessControlAction.AlertingReceiversWrite]);

        const { result } = renderHook(
          () => useContactPointAbility({ action: ContactPointAction.Update, context: readOnlyEntity }),
          { wrapper: createAlertmanagerWrapper(amSource) }
        );

        expect(isInsufficientPermissions(result.current)).toBe(true);
      });
    });

    describe('Delete', () => {
      it('should grant Delete when write permission is held and entity is deletable', () => {
        const amSource = setupGrafanaAlertmanager();
        grantUserPermissions([GRAFANA_AM_VISIBILITY_PERMISSION, AccessControlAction.AlertingReceiversWrite]);

        const { result } = renderHook(
          () => useContactPointAbility({ action: ContactPointAction.Delete, context: editableEntity }),
          { wrapper: createAlertmanagerWrapper(amSource) }
        );

        expect(result.current.granted).toBe(true);
      });

      it('should return Provisioned for Delete when entity is provisioned', () => {
        const amSource = setupGrafanaAlertmanager();
        grantUserPermissions([GRAFANA_AM_VISIBILITY_PERMISSION, AccessControlAction.AlertingReceiversWrite]);

        const { result } = renderHook(
          () => useContactPointAbility({ action: ContactPointAction.Delete, context: provisionedEntity }),
          { wrapper: createAlertmanagerWrapper(amSource) }
        );

        expect(isProvisioned(result.current)).toBe(true);
      });

      it('should return InsufficientPermissions for Delete when canDelete annotation is false', () => {
        const amSource = setupGrafanaAlertmanager();
        grantUserPermissions([GRAFANA_AM_VISIBILITY_PERMISSION, AccessControlAction.AlertingReceiversWrite]);

        const { result } = renderHook(
          () => useContactPointAbility({ action: ContactPointAction.Delete, context: readOnlyEntity }),
          { wrapper: createAlertmanagerWrapper(amSource) }
        );

        expect(isInsufficientPermissions(result.current)).toBe(true);
      });
    });

    describe('Export', () => {
      it('should grant Export when read permission is held and entity is not provisioned', () => {
        const amSource = setupGrafanaAlertmanager();
        grantUserPermissions([GRAFANA_AM_VISIBILITY_PERMISSION]);

        const { result } = renderHook(
          () => useContactPointAbility({ action: ContactPointAction.Export, context: editableEntity }),
          { wrapper: createAlertmanagerWrapper(amSource) }
        );

        expect(result.current.granted).toBe(true);
      });

      it('should return Provisioned for Export when entity is provisioned', () => {
        const amSource = setupGrafanaAlertmanager();
        grantUserPermissions([GRAFANA_AM_VISIBILITY_PERMISSION]);

        const { result } = renderHook(
          () => useContactPointAbility({ action: ContactPointAction.Export, context: provisionedEntity }),
          { wrapper: createAlertmanagerWrapper(amSource) }
        );

        expect(isProvisioned(result.current)).toBe(true);
      });
    });
  });

  describe('vanilla Prometheus alertmanager', () => {
    it('should deny Create / Update / Delete and list the expected required permissions', () => {
      // Vanilla Prometheus AM is set up but 'does-not-exist' is returned as the source name,
      // so no AM resolves. The hooks are pure RBAC checks with no AM-type branching,
      // so the result is INSUFFICIENT_PERMISSIONS (not NOT_SUPPORTED).
      // The snapshot captures the anyOfPermissions list shown in the UI tooltip.
      const amSource = setupVanillaPrometheusAlertmanager();
      grantUserPermissions([]);

      const { result } = renderHook(
        () => ({
          create: useContactPointAbility({ action: ContactPointAction.Create }),
          update: useContactPointAbility({ action: ContactPointAction.Update, context: editableEntity }),
          delete: useContactPointAbility({ action: ContactPointAction.Delete, context: editableEntity }),
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
    it('should deny View / Create / Export and list the expected required permissions', () => {
      // The contact point hooks only check Grafana-AM-specific permissions, so external
      // permissions are never sufficient. The snapshot captures the anyOfPermissions list.
      setupMimirAlertmanager(MIMIR_DATASOURCE_UID);
      grantUserPermissions([
        EXTERNAL_AM_VISIBILITY_PERMISSION,
        AccessControlAction.AlertingNotificationsExternalRead,
        AccessControlAction.AlertingNotificationsExternalWrite,
      ]);

      const { result } = renderHook(
        () => ({
          view: useContactPointAbility({ action: ContactPointAction.View }),
          create: useContactPointAbility({ action: ContactPointAction.Create }),
          export: useContactPointAbility({ action: ContactPointAction.Export, context: editableEntity }),
        }),
        { wrapper: createAlertmanagerWrapper(MIMIR_DATASOURCE_UID) }
      );

      expect(result.current.view.granted).toBe(false);
      expect(result.current.create.granted).toBe(false);
      expect(result.current.export.granted).toBe(false);
      expect(result.current).toMatchSnapshot();
    });
  });
});
