import { useState, useEffect } from 'react';
import { DatasourceStatus } from '@grafana/ui/src/types/plugin';

export const useLokiForceRefresh = (
  datasourceStatus: DatasourceStatus,
  refreshLabels: (forceRefresh?: boolean) => void,
  initialDatasourceStatus?: DatasourceStatus
) => {
  const [prevDatasourceStatus, setPrevDatasourceStatus] = useState(
    initialDatasourceStatus || DatasourceStatus.Connected
  );
  const [forceRefresh, setForceRefresh] = useState(false);

  // Effects
  useEffect(() => {
    const reconnected =
      datasourceStatus === DatasourceStatus.Connected && prevDatasourceStatus === DatasourceStatus.Disconnected;
    setPrevDatasourceStatus(datasourceStatus);
    setForceRefresh(reconnected);
  }, [datasourceStatus]);

  useEffect(() => {
    if (forceRefresh) {
      refreshLabels(forceRefresh);
    }
  }, [forceRefresh]);
};
