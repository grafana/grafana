import { useAsync } from 'react-use';

import { config } from '@grafana/runtime';
import { FlagKeys, getFeatureFlagClient } from '@grafana/runtime/internal';

import { getDataSourceK8sResourceByUid, type DataSourceSettingsK8s } from '../api';

export interface DataSourceProvisioning {
  /**
   * The stored Kubernetes object, whose `metadata.annotations` say which system manages the data
   * source. Undefined while loading, when provisioning is off, or when the read failed.
   */
  resource?: DataSourceSettingsK8s;
  isLoading: boolean;
}

/**
 * Reads the stored Kubernetes DataSource so the settings page can tell whether the data source is
 * provisioned and by what. It is a second read rather than a field on the settings the page already
 * has, because the legacy settings model carries no annotations.
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
      return await getDataSourceK8sResourceByUid(uid, config.namespace);
    } catch (error) {
      // The page works without this: an unreadable object only means no provisioning surfaces.
      console.warn('Could not read the provisioning state of the data source', error);
      return undefined;
    }
  }, [enabled, uid]);

  return { resource: value, isLoading: loading };
}
