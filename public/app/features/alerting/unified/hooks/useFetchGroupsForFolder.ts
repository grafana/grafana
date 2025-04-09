import { alertRuleApi } from '../api/alertRuleApi';
import { GRAFANA_RULER_CONFIG } from '../api/featureDiscoveryApi';

/**
 * Fetch groups for a given folder UID.
 */
export const useFetchGroupsForFolder = (folderUid: string) => {
  return alertRuleApi.endpoints.rulerNamespace.useQuery(
    {
      namespace: folderUid,
      rulerConfig: GRAFANA_RULER_CONFIG,
    },
    {
      refetchOnMountOrArgChange: true,
      skip: !folderUid,
    }
  );
};
