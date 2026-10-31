import { useAsync } from 'react-use';

import { config } from '@grafana/runtime';
import { FlagKeys, getFeatureFlagClient } from '@grafana/runtime/internal';
import { getBackendSrv } from 'app/core/services/backend_srv';

import { type ManagedResource } from '../../provisioning/utils/managedResource';

export interface DataSourceProvisioning {
  /**
   * Carries the stored object's annotations, which say which system manages the data source.
   * Undefined while loading, when provisioning is off, or when the read failed.
   */
  resource?: ManagedResource;
  isLoading: boolean;
}

/** An item of the connections list; only the fields this needs are typed. */
interface DataSourceConnection {
  name?: string;
  annotations?: Record<string, string>;
}

/**
 * Reads which system manages a data source, so the settings page can show it as provisioned.
 *
 * It reads the connections endpoint rather than the data source itself because connections is
 * answered from the collection in unified storage, while a per-type read goes through the dual
 * writer — which below mode 4 returns the legacy row, and the legacy table has no column for the
 * manager annotations. Going through connections makes this work in every dual-writer mode.
 *
 * Skipped unless provisioning is enabled and the data source CRUD APIs serve the page, which is the
 * only configuration where a data source can be repository-managed in the first place. A failed
 * read resolves to no resource, so the page falls back to its unprovisioned behaviour.
 */
export function useDataSourceProvisioning(uid: string): DataSourceProvisioning {
  const enabled =
    Boolean(config.provisioningEnabled) &&
    getFeatureFlagClient().getBooleanValue(FlagKeys.DatasourcesConfigUiUseNewDatasourceCRUDAPIs, false);

  const { value, loading } = useAsync(async () => {
    if (!enabled || !uid) {
      return undefined;
    }
    try {
      const response = await getBackendSrv().get<{ items?: DataSourceConnection[] }>(
        `/apis/query.grafana.app/v0alpha1/namespaces/${config.namespace}/connections`,
        { name: uid },
        undefined,
        { showErrorAlert: false }
      );
      const connection = response.items?.find((item) => item.name === uid);
      if (!connection?.annotations) {
        return undefined;
      }
      return { metadata: { annotations: connection.annotations } };
    } catch (error) {
      // The page works without this: an unreadable connection only means no provisioning surfaces.
      console.warn('Could not read the provisioning state of the data source', error);
      return undefined;
    }
  }, [enabled, uid]);

  return { resource: value, isLoading: loading };
}
