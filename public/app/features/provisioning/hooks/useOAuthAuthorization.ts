import { useCallback, useEffect, useRef, useState } from 'react';

import { type OAuthConnectionType } from '../types';
import { buildOAuthAuthorizeUrl, onOAuthAuthorizationComplete } from '../utils/connectionOAuth';

interface AuthorizeParams {
  type: OAuthConnectionType;
  clientID: string;
  name: string;
  serverUrl?: string;
}

// Runs the OAuth authorization round-trip in a separate tab so the current
// page (and its form state) stays put. Call `openTab` synchronously from the
// user action so popup blockers allow the tab, then `authorize` to navigate it
// once the connection is saved (or `closeTab` if saving failed). The callback
// tab reports the result, which is forwarded to `onComplete`.
export function useOAuthAuthorization(onComplete: (connectionName: string, error?: string) => void) {
  const tabRef = useRef<Window | null>(null);
  const [pendingName, setPendingName] = useState<string>();
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    if (!pendingName) {
      return;
    }
    return onOAuthAuthorizationComplete((name, error) => {
      if (name === pendingName) {
        setPendingName(undefined);
        onCompleteRef.current(name, error);
      }
    });
  }, [pendingName]);

  const openTab = useCallback(() => {
    if (!tabRef.current || tabRef.current.closed) {
      tabRef.current = window.open('', '_blank');
      if (tabRef.current) {
        tabRef.current.opener = null;
      }
    }
  }, []);

  const closeTab = useCallback(() => {
    tabRef.current?.close();
    tabRef.current = null;
  }, []);

  const authorize = useCallback(({ type, clientID, name, serverUrl }: AuthorizeParams) => {
    const url = buildOAuthAuthorizeUrl(type, clientID, name, serverUrl, { popup: true });
    if (tabRef.current) {
      tabRef.current.location.href = url;
    } else {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
    tabRef.current = null;
    setPendingName(name);
  }, []);

  const cancel = useCallback(() => setPendingName(undefined), []);

  return { openTab, closeTab, authorize, cancel, isPending: Boolean(pendingName) };
}
