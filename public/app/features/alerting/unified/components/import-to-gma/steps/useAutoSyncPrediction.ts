import { useMemo } from 'react';

import { useStagedConfig } from '../../../settings/import/useStagedConfig';
import { type PredictedSyncIdentifier } from '../../../utils/autoSync';
import { useListNotificationPolicyRoutes } from '../../notification-policies/useNotificationPolicyRoute';
import { useAutoSyncConfiguration } from '../../settings/useAutoSyncConfiguration';

/**
 * Predicts the policy tree name of the first sync. Returns undefined until the policy trees, the staged
 * import and the Config have loaded. Without that wait, a name recorded on the Config could flash as a
 * conflict. A list that failed to load counts as empty, because the sync has the final say.
 */
export function useAutoSyncPrediction(
  autoSyncActive: boolean,
  datasourceUID: string | undefined,
  datasourceName: string | null | undefined
): PredictedSyncIdentifier | undefined {
  const { predictSyncIdentifier, isLoading: isLoadingAutoSyncConfig } = useAutoSyncConfiguration();
  const {
    data: policyTrees,
    isSuccess: hasPolicyTrees,
    isError: failedPolicyTrees,
  } = useListNotificationPolicyRoutes({ skip: !autoSyncActive });
  const { stagedConfig, isLoading: isLoadingStagedConfig } = useStagedConfig({ skip: !autoSyncActive });
  const stagedIdentifier = stagedConfig?.identifier;

  return useMemo(() => {
    if (
      !autoSyncActive ||
      !datasourceUID ||
      !datasourceName ||
      isLoadingAutoSyncConfig ||
      isLoadingStagedConfig ||
      !(hasPolicyTrees || failedPolicyTrees)
    ) {
      return undefined;
    }
    return predictSyncIdentifier(datasourceUID, datasourceName, {
      policyTreeNames: new Set((policyTrees ?? []).flatMap((tree) => (tree.name ? [tree.name] : []))),
      stagedIdentifiers: new Set(stagedIdentifier ? [stagedIdentifier] : []),
    });
  }, [
    autoSyncActive,
    datasourceUID,
    datasourceName,
    isLoadingAutoSyncConfig,
    isLoadingStagedConfig,
    hasPolicyTrees,
    failedPolicyTrees,
    policyTrees,
    stagedIdentifier,
    predictSyncIdentifier,
  ]);
}

export function usePredictedAutoSyncIdentifier(
  autoSyncActive: boolean,
  datasourceUID: string | undefined,
  datasourceName: string | null | undefined
): string | undefined {
  return useAutoSyncPrediction(autoSyncActive, datasourceUID, datasourceName)?.identifier;
}
