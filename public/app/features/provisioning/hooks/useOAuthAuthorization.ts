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
// tab reports the result, which is forwarded to `onComplete`; `cancel()` ends
// the pending state — the tab cannot be observed once the provider page loads.
// `authorize` returns false when the browser blocked opening the tab.
export function useOAuthAuthorization(onComplete: (connectionName: string, error?: string) => void) {
  const tabRef = useRef<Window | null>(null);
  const [pendingName, setPendingName] = useState<string>();
  const [isPending, setIsPending] = useState(false);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    if (!pendingName) {
      return;
    }
    // COOP on provider pages (e.g. gitlab.com) severs the opened tab's handle, so
    // `tab.closed` can report true while authorization is still running. Tab state
    // is unobservable; pending ends only via the completion message or cancel().
    return onOAuthAuthorizationComplete((name, error) => {
      if (name === pendingName) {
        setPendingName(undefined);
        setIsPending(false);
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

  const authorize = useCallback(
    ({ type, clientID, name, serverUrl }: AuthorizeParams): boolean => {
      const url = buildOAuthAuthorizeUrl(type, clientID, name, serverUrl, { popup: true });
      openTab();
      if (!tabRef.current) {
        return false;
      }
      tabRef.current.location.href = url;
      setPendingName(name);
      setIsPending(true);
      return true;
    },
    [openTab]
  );

  const cancel = useCallback(() => {
    setPendingName(undefined);
    setIsPending(false);
  }, []);

  return { openTab, closeTab, authorize, cancel, isPending };
}
