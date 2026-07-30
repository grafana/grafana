import { useCallback, useEffect, useState } from 'react';

import { type OAuthConnectionType } from '../types';
import { buildOAuthAuthorizeUrl, onOAuthAuthorizationComplete } from '../utils/connectionOAuth';

// Drives the OAuth app authorization handoff: open the provider's authorize
// URL in a new tab (must be called from a user gesture so popup blockers
// allow it) and wait for the callback tab to broadcast completion.
export function useOAuthAuthorizeFlow(onAuthorized: (connectionName: string) => void) {
  const [pendingName, setPendingName] = useState<string>();
  const [authorizeError, setAuthorizeError] = useState<string>();

  useEffect(() => {
    if (!pendingName) {
      return;
    }
    return onOAuthAuthorizationComplete((name, error) => {
      if (name !== pendingName) {
        return;
      }
      setPendingName(undefined);
      if (error !== undefined) {
        setAuthorizeError(error);
      } else {
        onAuthorized(name);
      }
    });
  }, [pendingName, onAuthorized]);

  // Returns false when the popup was blocked (no transient user activation left).
  const authorize = useCallback(
    (type: OAuthConnectionType, clientID: string, connectionName: string, serverUrl?: string) => {
      setAuthorizeError(undefined);
      const tab = window.open(
        buildOAuthAuthorizeUrl(type, clientID, connectionName, serverUrl, { popup: true }),
        '_blank'
      );
      if (!tab) {
        return false;
      }
      setPendingName(connectionName);
      return true;
    },
    []
  );

  const cancelAuthorization = useCallback(() => setPendingName(undefined), []);

  return { authorize, cancelAuthorization, pendingName, authorizeError };
}
