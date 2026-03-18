import { useCallback, useState } from 'react';

interface UseDisconnectOrphanedResourceOptions {
  uid: string;
  resourceType: 'dashboards' | 'folders';
}

interface UseDisconnectOrphanedResourceResult {
  disconnect: () => Promise<void>;
  isDisconnecting: boolean;
  error: unknown;
}

export function useDisconnectOrphanedResource({
  uid,
  resourceType,
}: UseDisconnectOrphanedResourceOptions): UseDisconnectOrphanedResourceResult {
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const group = resourceType === 'dashboards' ? 'dashboard.grafana.app' : 'folder.grafana.app';
  const version = resourceType === 'dashboards' ? 'v2beta1' : 'v1beta1';

  const disconnect = useCallback(async () => {
    setIsDisconnecting(true);
    setError(null);

    try {
        // TBD
    } catch (err) {
      setError(err);
      throw err;
    } finally {
      setIsDisconnecting(false);
    }
  }, [group, version, resourceType, uid]);

  return { disconnect, isDisconnecting, error };
}
