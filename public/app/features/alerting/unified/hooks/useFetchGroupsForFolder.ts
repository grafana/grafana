import { alertRuleApi } from '../api/alertRuleApi';
import { GRAFANA_RULER_CONFIG } from '../api/featureDiscoveryApi';

/**
 * Fetch groups for a given folder UID.
 * This hook only returns the rules that are directly in the folder. Rules in subfolders are not included.
 * @param folderUid - The UID of the folder to fetch groups for.
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
