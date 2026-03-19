/**
 * CursorOnlyProvider — lightweight provider that only subscribes to the cursors
 * Centrifuge channel, without ops, locks, presence, or session management.
 *
 * Used when `dashboardCursorSync` is enabled but `dashboardCollaboration` is off.
 */

import { useCallback, useEffect, useMemo, useRef, useState, type PropsWithChildren } from 'react';
import { Subscription } from 'rxjs';

import {
  isLiveChannelMessageEvent,
  isLiveChannelStatusEvent,
  LiveChannelConnectionState,
  LiveChannelScope,
  type LiveChannelAddress,
} from '@grafana/data';
import { config, getGrafanaLiveSrv } from '@grafana/runtime';

import { CollabContext, type CollabContextValue } from './CollabContext';
import { onVisibilityChange } from './collabEdgeCases';
import { debugLog } from './debugLog';
import type { CursorUpdate } from './protocol/messages';

interface CursorOnlyProviderProps {
  dashboardUID: string;
  namespace: string;
}

function makeCursorsAddress(namespace: string, uid: string): LiveChannelAddress {
  return {
    scope: LiveChannelScope.Grafana,
    stream: 'collab',
    path: `${namespace}/${uid}/cursors`,
  };
}

const noop = () => {};

export function CursorOnlyProvider({ dashboardUID, namespace, children }: PropsWithChildren<CursorOnlyProviderProps>) {
  const [connected, setConnected] = useState(false);
  const [cursors, setCursors] = useState<Map<string, CursorUpdate>>(new Map());
  const [tabHidden, setTabHidden] = useState(false);
  const localUserIdRef = useRef(config.bootData?.user?.uid ?? '');

  const cursorsAddress = useMemo(
    () => makeCursorsAddress(namespace, dashboardUID),
    [namespace, dashboardUID]
  );

  // Pause cursor sending when tab is hidden
  useEffect(() => {
    return onVisibilityChange((hidden) => setTabHidden(hidden));
  }, []);

  // Subscribe to cursors channel
  useEffect(() => {
    const live = getGrafanaLiveSrv();
    if (!live) {
      return;
    }

    const sub = new Subscription();
    const stream$ = live.getStream<CursorUpdate>(cursorsAddress);

    sub.add(
      stream$.subscribe({
        next: (event) => {
          if (isLiveChannelStatusEvent(event)) {
            if (event.state === LiveChannelConnectionState.Connected) {
              debugLog('CursorOnlyProvider connected', { dashboardUID });
              setConnected(true);
            } else if (
              event.state === LiveChannelConnectionState.Disconnected ||
              event.state === LiveChannelConnectionState.Shutdown
            ) {
              debugLog('CursorOnlyProvider disconnected', { dashboardUID });
              setConnected(false);
            }
          }

          if (isLiveChannelMessageEvent(event)) {
            const cursor = event.message;
            if (cursor.userId === localUserIdRef.current) {
              return;
            }
            setCursors((prev) => {
              const next = new Map(prev);
              next.set(cursor.userId, cursor);
              return next;
            });
          }
        },
        error: (err) => {
          debugLog('CursorOnlyProvider channel error', err);
          setConnected(false);
        },
      })
    );

    return () => sub.unsubscribe();
  }, [cursorsAddress, dashboardUID]);

  // Send cursor update
  const sendCursor = useCallback(
    (update: Omit<CursorUpdate, 'type'>) => {
      if (!cursorsAddress || tabHidden) {
        return;
      }
      const live = getGrafanaLiveSrv();
      if (live) {
        live.publish(cursorsAddress, { ...update, type: 'cursor' } satisfies CursorUpdate);
      }
    },
    [cursorsAddress, tabHidden]
  );

  const value = useMemo<CollabContextValue>(
    () => ({
      connected,
      users: [],
      locks: [],
      staleLocks: new Set<string>(),
      cursors,
      acquireLock: noop,
      releaseLock: noop,
      sendCursor,
      sendCheckpoint: noop,
    }),
    [connected, cursors, sendCursor]
  );

  return <CollabContext.Provider value={value}>{children}</CollabContext.Provider>;
}
