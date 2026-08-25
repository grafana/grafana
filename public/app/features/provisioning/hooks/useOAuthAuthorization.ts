import { useCallback, useEffect, useRef, useState } from 'react';

import { type OAuthConnectionType } from '../types';
import { buildOAuthAuthorizeUrl, onOAuthAuthorizationComplete } from '../utils/connectionOAuth';

// Poll the authorization tab so the user closing it ends the pending state.
const tabClosedPollInterval = 1_000;
// The callback tab posts its completion message right before closing itself,
// so give an in-flight message time to arrive before ending the pending state.
const completionGracePeriod = 2_000;

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
// tab reports the result, which is forwarded to `onComplete`; closing the tab
// without finishing ends the pending state. `authorize` returns false when the
// browser blocked opening the tab.
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
    const unsubscribe = onOAuthAuthorizationComplete((name, error) => {
      if (name === pendingName) {
        setPendingName(undefined);
        setIsPending(false);
        onCompleteRef.current(name, error);
      }
    });
    let graceTimeout: number | undefined;
    const poll = window.setInterval(() => {
      if (!tabRef.current || tabRef.current.closed) {
        window.clearInterval(poll);
        graceTimeout = window.setTimeout(() => setIsPending(false), completionGracePeriod);
      }
    }, tabClosedPollInterval);
    return () => {
      unsubscribe();
      window.clearInterval(poll);
      window.clearTimeout(graceTimeout);
    };
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
