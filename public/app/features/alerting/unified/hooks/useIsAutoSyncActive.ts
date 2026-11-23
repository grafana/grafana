import { useAutoSyncConfigQuery } from '../api/configApi';
import { deriveSyncSource } from '../utils/autoSync';

interface AutoSyncActiveState {
  isActive: boolean;
  isLoading: boolean;
}

// Fail-open: no data — loading, 404, 403, a skipped query, or a retry after one of those — derives no UID, so sync reads as
// inactive. The convert endpoint's IsExternalAMSyncConfiguredForOrg check is the real safety net.
export function useIsAutoSyncActive(): AutoSyncActiveState {
  const { data, isLoading } = useAutoSyncConfigQuery();

  return { isActive: Boolean(deriveSyncSource(data).uid), isLoading };
}
