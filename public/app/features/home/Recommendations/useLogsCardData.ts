import { useAsync } from 'react-use';

import { fetchLogsStats, fetchLogsVolume, resolveLogsDatasource } from './logsData';

export function useLogsCardData() {
  const { value: resolution, loading: resolving, error: resolutionError } = useAsync(resolveLogsDatasource, []);
  const { value: stats, loading: statsLoading } = useAsync(fetchLogsStats, []);
  const { value: volume, loading: volumeLoading } = useAsync(fetchLogsVolume, []);
  return {
    resolution,
    resolving,
    resolutionError,
    stats,
    statsLoading,
    volume,
    volumeLoading,
  };
}
