import { useCallback, useState } from 'react';
import { lastValueFrom } from 'rxjs';

import { getBackendSrv } from '@grafana/runtime';
import { getAPINamespace } from 'app/api/utils';
import {
  AnnoKeyManagerKind,
  AnnoKeyManagerIdentity,
  AnnoKeyManagerAllowsEdits,
  AnnoKeySourcePath,
  AnnoKeySourceChecksum,
  AnnoKeySourceTimestamp,
} from 'app/features/apiserver/types';

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
  const ns = getAPINamespace();

  const disconnect = useCallback(async () => {
    setIsDisconnecting(true);
    setError(null);

    try {
      await lastValueFrom(
        getBackendSrv().fetch({
          url: `/apis/${group}/${version}/namespaces/${ns}/${resourceType}/${uid}`,
          method: 'PATCH',
          headers: { 'Content-Type': 'application/merge-patch+json' },
          data: {
            metadata: {
              annotations: {
                [AnnoKeyManagerKind]: null,
                [AnnoKeyManagerIdentity]: null,
                [AnnoKeyManagerAllowsEdits]: null,
                [AnnoKeySourcePath]: null,
                [AnnoKeySourceChecksum]: null,
                [AnnoKeySourceTimestamp]: null,
              },
            },
          },
        })
      );
    } catch (err) {
      setError(err);
      throw err;
    } finally {
      setIsDisconnecting(false);
    }
  }, [group, version, ns, resourceType, uid]);

  return { disconnect, isDisconnecting, error };
}
