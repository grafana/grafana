/**
 * CollabProvider — manages real-time collaboration for a dashboard.
 *
 * Connects to Grafana Live channels (ops + cursors) via Centrifuge,
 * wires opExtractor (local scene changes → server) and opApplicator
 * (remote server messages → local scene), and provides collaboration
 * state via CollabContext.
 *
 * Gating: renders children as-is (no-op) when any of these fail:
 *   - dashboardCollaboration feature toggle
 *   - dashboard has collaboration annotation enabled
 *   - dashboard is not provisioned
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

import { DashboardMutationClient } from 'app/features/dashboard-scene/mutation-api/DashboardMutationClient';
import type { DashboardScene } from 'app/features/dashboard-scene/scene/DashboardScene';

import { CollabContext, type CollabContextValue, type CollabLock, type CollabUser } from './CollabContext';
import { applyRemoteOp } from './opApplicator';
import { extractMutationRequest } from './opExtractor';
import type {
  CheckpointOperation,
  ClientMessage,
  CollabOperation,
  CursorUpdate,
  LockOperation,
  ServerMessage,
} from './protocol/messages';

interface CollabProviderProps {
  scene: DashboardScene;
  dashboardUID: string;
  namespace: string;
}

/** Initial session state returned by the server on subscribe. */
interface SessionInfo {
  users: CollabUser[];
  locks: Record<string, string>; // target → userId
  seq: number;
}

export function isCollabEnabled(scene: DashboardScene): boolean {
  // Feature toggle
  if (!config.featureToggles.dashboardCollaboration) {
    return false;
  }

  // Not provisioned
  if (scene.state.meta?.provisioned) {
    return false;
  }

  // Collaboration annotation must be present
  const annotations = scene.state.meta?.annotationsPermissions;
  // For POC: we check the annotation constant from the dashboard metadata.
  // The annotation is set on the k8s resource, surfaced via dashboard meta.
  // For now, check if the dashboard has the collab feature opt-in.
  // In production this would check grafana.app/collaboration annotation.
  // For POC, we enable for all non-provisioned dashboards when the feature flag is on.
  void annotations; // suppress unused — will be checked in production

  return true;
}

function makeOpsAddress(namespace: string, uid: string): LiveChannelAddress {
  return {
    scope: LiveChannelScope.Grafana,
    stream: 'collab',
    path: `${namespace}/${uid}/ops`,
  };
}

function makeCursorsAddress(namespace: string, uid: string): LiveChannelAddress {
  return {
    scope: LiveChannelScope.Grafana,
    stream: 'collab',
    path: `${namespace}/${uid}/cursors`,
  };
}

export function CollabProvider({ scene, dashboardUID, namespace, children }: PropsWithChildren<CollabProviderProps>) {
  const [connected, setConnected] = useState(false);
  const [users, setUsers] = useState<CollabUser[]>([]);
  const [locks, setLocks] = useState<CollabLock[]>([]);
  const [cursors, setCursors] = useState<Map<string, CursorUpdate>>(new Map());

  const clientRef = useRef<DashboardMutationClient | null>(null);
  const localUserIdRef = useRef(config.bootData?.user?.uid ?? '');

  // Memoize the mutation client per scene
  useEffect(() => {
    clientRef.current = new DashboardMutationClient(scene);
    return () => {
      clientRef.current = null;
    };
  }, [scene]);

  const enabled = useMemo(() => isCollabEnabled(scene), [scene]);

  // Ops channel address
  const opsAddress = useMemo(
    () => (enabled ? makeOpsAddress(namespace, dashboardUID) : null),
    [enabled, namespace, dashboardUID]
  );

  // Cursors channel address
  const cursorsAddress = useMemo(
    () => (enabled ? makeCursorsAddress(namespace, dashboardUID) : null),
    [enabled, namespace, dashboardUID]
  );

  // Publish to ops channel
  const publishOp = useCallback(
    (msg: ClientMessage) => {
      if (!opsAddress) {
        return;
      }
      const live = getGrafanaLiveSrv();
      if (live) {
        live.publish(opsAddress, msg);
      }
    },
    [opsAddress]
  );

  // Wire opExtractor: scene state changes → server
  useEffect(() => {
    if (!enabled || !opsAddress) {
      return;
    }

    const sub = scene.subscribeToEvent(
      // SceneObjectStateChangedEvent is published by scenes on any state change
      { type: 'state-changed' } as any,
      (event: any) => {
        const collabOp = extractMutationRequest(event);
        if (collabOp) {
          const msg: ClientMessage = {
            kind: 'op',
            op: collabOp,
          };
          publishOp(msg);
        }
      }
    );

    return () => sub.unsubscribe();
  }, [enabled, opsAddress, scene, publishOp]);

  // Subscribe to ops channel
  useEffect(() => {
    if (!opsAddress) {
      return;
    }

    const live = getGrafanaLiveSrv();
    if (!live) {
      return;
    }

    const sub = new Subscription();

    const stream$ = live.getStream<ServerMessage>(opsAddress);
    sub.add(
      stream$.subscribe({
        next: (event) => {
          // Status events carry initial session state
          if (isLiveChannelStatusEvent(event)) {
            if (event.state === LiveChannelConnectionState.Connected) {
              setConnected(true);
              // Parse initial session info from subscribe data
              if (event.message) {
                const info = event.message as SessionInfo;
                if (info.users) {
                  setUsers(info.users);
                }
                if (info.locks) {
                  setLocks(
                    Object.entries(info.locks).map(([target, userId]) => ({ target, userId }))
                  );
                }
              }
            } else if (
              event.state === LiveChannelConnectionState.Disconnected ||
              event.state === LiveChannelConnectionState.Shutdown
            ) {
              setConnected(false);
            }
          }

          // Message events are ServerMessages (ops, locks, etc.)
          if (isLiveChannelMessageEvent(event)) {
            const msg = event.message;

            if (msg.kind === 'op' && clientRef.current) {
              applyRemoteOp(msg, clientRef.current, localUserIdRef.current).catch((err) => {
                console.error('[collab] Failed to apply remote op:', err);
              });
            }

            if (msg.kind === 'lock') {
              const lockOp = msg.op as LockOperation;
              if (lockOp.type === 'lock') {
                setLocks((prev) => {
                  // Replace existing lock on same target, or add new
                  const filtered = prev.filter((l) => l.target !== lockOp.target);
                  return [...filtered, { target: lockOp.target, userId: lockOp.userId }];
                });
              } else if (lockOp.type === 'unlock') {
                setLocks((prev) => prev.filter((l) => l.target !== lockOp.target));
              }
            }

            if (msg.kind === 'presence') {
              // Presence events update user list — server sends full user list on presence changes
              const presenceUsers = msg.op as CollabUser[] | null;
              if (Array.isArray(presenceUsers)) {
                setUsers(presenceUsers);
              }
            }
          }
        },
        error: (err) => {
          console.error('[collab] Ops channel error:', err);
          setConnected(false);
        },
      })
    );

    return () => sub.unsubscribe();
  }, [opsAddress]);

  // Subscribe to cursors channel
  useEffect(() => {
    if (!cursorsAddress) {
      return;
    }

    const live = getGrafanaLiveSrv();
    if (!live) {
      return;
    }

    const sub = new Subscription();

    const stream$ = live.getStream<CursorUpdate>(cursorsAddress);
    sub.add(
      stream$.subscribe({
        next: (event) => {
          if (isLiveChannelMessageEvent(event)) {
            const cursor = event.message;
            // Skip own cursor updates
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
      })
    );

    return () => sub.unsubscribe();
  }, [cursorsAddress]);

  // Lock acquisition
  const acquireLock = useCallback(
    (target: string) => {
      const msg: ClientMessage = {
        kind: 'lock',
        op: {
          type: 'lock',
          target,
          userId: localUserIdRef.current,
        } satisfies LockOperation,
      };
      publishOp(msg);
    },
    [publishOp]
  );

  // Lock release
  const releaseLock = useCallback(
    (target: string) => {
      const msg: ClientMessage = {
        kind: 'lock',
        op: {
          type: 'unlock',
          target,
          userId: localUserIdRef.current,
        } satisfies LockOperation,
      };
      publishOp(msg);
    },
    [publishOp]
  );

  // Send checkpoint (manual save) request
  const sendCheckpoint = useCallback(
    (message?: string) => {
      const msg: ClientMessage = {
        kind: 'checkpoint',
        op: {
          type: 'checkpoint',
          message,
        } satisfies CheckpointOperation,
      };
      publishOp(msg);
    },
    [publishOp]
  );

  // Send cursor update
  const sendCursor = useCallback(
    (update: Omit<CursorUpdate, 'type'>) => {
      if (!cursorsAddress) {
        return;
      }
      const live = getGrafanaLiveSrv();
      if (live) {
        live.publish(cursorsAddress, { ...update, type: 'cursor' } satisfies CursorUpdate);
      }
    },
    [cursorsAddress]
  );

  const value = useMemo<CollabContextValue>(
    () => ({
      connected,
      users,
      locks,
      cursors,
      acquireLock,
      releaseLock,
      sendCursor,
      sendCheckpoint,
    }),
    [connected, users, locks, cursors, acquireLock, releaseLock, sendCursor, sendCheckpoint]
  );

  return <CollabContext.Provider value={value}>{children}</CollabContext.Provider>;
}
