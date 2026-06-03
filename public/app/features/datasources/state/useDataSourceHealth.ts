import { useEffect, useState } from 'react';

import { getBackendSrv, isFetchError } from '@grafana/runtime';

export type HealthStatus = 'loading' | 'healthy' | 'unhealthy';

export interface DataSourceHealth {
  status: HealthStatus;
  message?: string;
}

interface HealthResponse {
  status?: string;
  message?: string;
}

/**
 * Runs a live health check against a single data source via the backend
 * `/health` endpoint. Intended to be called lazily (e.g. only for rows that are
 * actually rendered), since each call triggers a backend plugin health check.
 */
export function useDataSourceHealth(uid: string): DataSourceHealth {
  const [health, setHealth] = useState<DataSourceHealth>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    setHealth({ status: 'loading' });

    getBackendSrv()
      .get<HealthResponse>(`/api/datasources/uid/${uid}/health`, undefined, undefined, { showErrorAlert: false })
      .then((res) => {
        if (cancelled) {
          return;
        }
        const healthy = res?.status === 'OK';
        setHealth({ status: healthy ? 'healthy' : 'unhealthy', message: res?.message });
      })
      .catch((err: unknown) => {
        if (cancelled) {
          return;
        }
        const message = isFetchError<HealthResponse>(err) ? err.data?.message : undefined;
        setHealth({ status: 'unhealthy', message });
      });

    return () => {
      cancelled = true;
    };
  }, [uid]);

  return health;
}
