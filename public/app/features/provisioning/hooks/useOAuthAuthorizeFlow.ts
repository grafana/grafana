import { useCallback, useEffect, useRef, useState } from 'react';

import { type OAuthConnectionType } from '../types';
import { buildOAuthAuthorizeUrl, onOAuthAuthorizationComplete } from '../utils/connectionOAuth';

// Drives the OAuth app authorization handoff: open a tab synchronously (so
// popup blockers allow it) before the async save, point it at the provider's
// authorize URL once the connection exists, and wait for the callback tab to
// broadcast completion.
export function useOAuthAuthorizeFlow(onAuthorized: (connectionName: string) => void) {
  const authTabRef = useRef<Window | null>(null);
  const [pendingName, setPendingName] = useState<string>();

  useEffect(() => {
    if (!pendingName) {
      return;
    }
    return onOAuthAuthorizationComplete((name) => {
      if (name === pendingName) {
        onAuthorized(name);
      }
    });
  }, [pendingName, onAuthorized]);

  const openAuthTab = useCallback(() => {
    authTabRef.current = window.open('', '_blank');
  }, []);

  const closeAuthTab = useCallback(() => {
    authTabRef.current?.close();
    authTabRef.current = null;
  }, []);

  const authorize = useCallback(
    (type: OAuthConnectionType, clientID: string, connectionName: string, serverUrl?: string) => {
      const url = buildOAuthAuthorizeUrl(type, clientID, connectionName, serverUrl, { popup: true });
      if (authTabRef.current) {
        authTabRef.current.location.href = url;
        authTabRef.current = null;
      } else {
        window.open(url, '_blank');
      }
      setPendingName(connectionName);
    },
    []
  );

  const cancelAuthorization = useCallback(() => setPendingName(undefined), []);

  return { openAuthTab, closeAuthTab, authorize, cancelAuthorization, pendingName };
}
