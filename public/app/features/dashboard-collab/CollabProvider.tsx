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
import { t } from '@grafana/i18n';
import { config, getGrafanaLiveSrv, locationService } from '@grafana/runtime';
import { SceneObjectStateChangedEvent } from '@grafana/scenes';
import { useAppNotification } from 'app/core/copy/appNotification';
import type { DashboardScene } from 'app/features/dashboard-scene/scene/DashboardScene';
import { setDashboardMutationClient } from 'app/features/plugins/components/restrictedGrafanaApis/dashboardMutation/dashboardMutationApi';

import { CollabContext, type CollabContextValue, type CollabLock, type CollabUser } from './CollabContext';
import { CollabMutationClient } from './CollabMutationClient';
import {
  classifyChannelError,
  CHANNEL_ERROR_DASHBOARD_DELETED,
  CHANNEL_ERROR_PERMISSION_DENIED,
  STALE_LOCK_THRESHOLD_MS,
  onVisibilityChange,
} from './collabEdgeCases';
import { debugLog } from './debugLog';
import { applyRemoteOp } from './opApplicator';
import { extractMutationRequest, setLargeDashboardMode } from './opExtractor';
import type {
  CheckpointOperation,
  ClientMessage,
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
    debugLog('isCollabEnabled: disabled — feature toggle dashboardCollaboration is off');
    return false;
  }

  // Not provisioned
  if (scene.state.meta?.provisioned) {
    debugLog('isCollabEnabled: disabled — dashboard is provisioned');
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

  debugLog('isCollabEnabled: enabled for dashboard', scene.state.uid);
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

/** Safely narrow an unknown value to a string-keyed record (returns undefined for non-objects). */
function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (value != null && typeof value === 'object') {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- runtime-checked narrowing
    return value as Record<string, unknown>;
  }
  return undefined;
}

export function CollabProvider({ scene, dashboardUID, namespace, children }: PropsWithChildren<CollabProviderProps>) {
  // Guard: scene must be active (SceneObjectBase sets _events on activation).
  // Wrap in a safe check — if scene isn't ready, skip collab features but still render children.
  const sceneReady = Boolean(scene?.isActive);
  const [connected, setConnected] = useState(false);
  const [users, setUsers] = useState<CollabUser[]>([]);
  const [locks, setLocks] = useState<CollabLock[]>([]);
  const [cursors, setCursors] = useState<Map<string, CursorUpdate>>(new Map());
  const [staleLocks, setStaleLocks] = useState<Set<string>>(new Set());
  const [tabHidden, setTabHidden] = useState(false);

  const clientRef = useRef<CollabMutationClient | null>(null);
  const localUserIdRef = useRef(config.bootData?.user?.uid ?? '');
  // Track when each lock was acquired for stale lock detection.
  const lockTimestampsRef = useRef<Map<string, number>>(new Map());
  // Track auto-clear timer IDs for activity-based locks (keyed by "target:userId").
  const lockTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const lastOpByUserRef = useRef<Map<string, number>>(new Map());
  const notifyApp = useAppNotification();

  // Ref-based publishOp forwarder so the wrapper doesn't depend on the
  // useCallback identity (which is defined later in the hook chain).
  const publishOpRef = useRef<(msg: ClientMessage) => void>(() => {});

  const enabled = useMemo(() => sceneReady && isCollabEnabled(scene), [scene, sceneReady]);

  // Edge case #4: Pause cursor sending when tab is hidden
  useEffect(() => {
    return onVisibilityChange((hidden) => setTabHidden(hidden));
  }, []);

  // Edge case #6: Detect stale locks (held >5min with no ops from holder)
  useEffect(() => {
    if (!connected || locks.length === 0) {
      setStaleLocks(new Set());
      return;
    }

    const interval = setInterval(() => {
      const now = Date.now();
      const stale = new Set<string>();

      for (const lock of locks) {
        // Don't flag own locks as stale
        if (lock.userId === localUserIdRef.current) {
          continue;
        }
        const acquiredAt = lockTimestampsRef.current.get(lock.target) ?? now;
        const lastOp = lastOpByUserRef.current.get(lock.userId);
        const referenceTime = lastOp ?? acquiredAt;
        if (now - referenceTime > STALE_LOCK_THRESHOLD_MS) {
          stale.add(lock.target);
        }
      }

      setStaleLocks((prev) => {
        // Only update if changed
        if (stale.size === prev.size && [...stale].every((t) => prev.has(t))) {
          return prev;
        }
        return stale;
      });
    }, 30_000); // Check every 30s

    return () => clearInterval(interval);
  }, [connected, locks]);

  // Ops channel address
  const opsAddress = useMemo(
    () => (enabled ? makeOpsAddress(namespace, dashboardUID) : null),
    [enabled, namespace, dashboardUID]
  );

  // Cursors channel address — only when dashboardCursorSync is explicitly enabled
  const cursorSyncEnabled = Boolean(config.featureToggles.dashboardCursorSync);
  const cursorsAddress = useMemo(
    () => (enabled && cursorSyncEnabled ? makeCursorsAddress(namespace, dashboardUID) : null),
    [enabled, cursorSyncEnabled, namespace, dashboardUID]
  );

  // Publish to ops channel
  const publishOp = useCallback(
    (msg: ClientMessage) => {
      if (!opsAddress) {
        return;
      }
      const live = getGrafanaLiveSrv();
      if (live) {
        debugLog('Publishing op', { kind: msg.kind });
        live.publish(opsAddress, msg);
      }
    },
    [opsAddress]
  );

  // Keep the ref in sync so the wrapper always uses the latest publishOp.
  publishOpRef.current = publishOp;

  // Wrap the scene's mutation client with CollabMutationClient.
  // The scene may not have its client ready yet at mount time (activation timing),
  // so we poll briefly until it's available.
  useEffect(() => {
    debugLog('CollabProvider mounted', { dashboardUID, namespace });

    let originalClient = scene.getMutationClient();
    let wrapper: CollabMutationClient | null = null;
    let pollTimer: ReturnType<typeof setTimeout> | null = null;

    const install = () => {
      originalClient = scene.getMutationClient();
      if (!originalClient) {
        debugLog('CollabProvider: mutation client not yet available — retrying in 100ms');
        pollTimer = setTimeout(install, 100);
        return;
      }

      wrapper = new CollabMutationClient(
        originalClient,
        (msg) => publishOpRef.current(msg),
        localUserIdRef.current
      );
      clientRef.current = wrapper;
      scene.setMutationClient(wrapper);
      setDashboardMutationClient(wrapper);
      debugLog('CollabMutationClient wrapper installed');
    };

    install();

    return () => {
      if (pollTimer) {
        clearTimeout(pollTimer);
      }
      debugLog('CollabProvider unmounting — restoring original mutation client', { dashboardUID });
      clientRef.current = null;
      if (scene.isActive && originalClient) {
        scene.setMutationClient(originalClient);
        setDashboardMutationClient(originalClient);
      }
    };
  }, [scene, dashboardUID, namespace]);

  // Wire opExtractor: scene state changes → server
  useEffect(() => {
    if (!enabled || !opsAddress) {
      return;
    }

    // Edge case #5: enable throttle for large dashboards
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- DashboardScene satisfies the structural type but TS needs explicit cast
    setLargeDashboardMode(scene as { state: { body?: { state?: { children?: unknown[] } } } });

    // Suppress op sending for 3 seconds after mount to let the scene settle.
    // Scene state changes during page load (data queries, transforms) produce
    // false UPDATE_PANEL ops that would lock panels on other browsers.
    let warmupComplete = false;
    const warmupTimer = setTimeout(() => {
      warmupComplete = true;
      debugLog('Op extraction warmup complete — now sending ops');
    }, 3000);

    const sub = scene.subscribeToEvent(
      SceneObjectStateChangedEvent,
      (event: SceneObjectStateChangedEvent) => {
        if (!warmupComplete) {
          return;
        }

        const collabOp = extractMutationRequest(event);
        if (collabOp) {
          debugLog('Op sent', { mutationType: collabOp.mutation.type, lockTarget: collabOp.lockTarget });

          if (collabOp.lockTarget) {
            activePanelsRef.current.add(collabOp.lockTarget);
          }

          const msg: ClientMessage = {
            kind: 'op',
            op: {
              ...collabOp,
              userId: localUserIdRef.current,
            },
          };
          publishOp(msg);
        }
      }
    );

    return () => {
      clearTimeout(warmupTimer);
      sub.unsubscribe();
    };
  }, [enabled, opsAddress, scene, publishOp]);

  // Track which panels we've sent ops for — send unlock on deselect
  const activePanelsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!enabled || !opsAddress) {
      return;
    }
    const stateRecord = asRecord(scene.state);
    const editPane = stateRecord?.editPane;
    const editPaneRecord = asRecord(editPane);
    if (!editPaneRecord || typeof editPaneRecord.subscribeToState !== 'function') {
      return;
    }
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- runtime typeof check above guarantees this is a function
    const subscribeToState = editPaneRecord.subscribeToState as (cb: (state: Record<string, unknown>) => void) => { unsubscribe: () => void };
    let prevHasSelection = false;
    const sub = subscribeToState((state: Record<string, unknown>) => {
      const hasSelection = !!state.selection;
      if (prevHasSelection && !hasSelection && activePanelsRef.current.size > 0) {
        // User deselected — send unlock for all active panels
        debugLog('Panel deselected — sending unlock', { targets: Array.from(activePanelsRef.current) });
        for (const target of activePanelsRef.current) {
          const unlockMsg: ClientMessage = {
            kind: 'unlock',
            op: {
              target,
              userId: localUserIdRef.current,
            },
          };
          publishOp(unlockMsg);
        }
        activePanelsRef.current.clear();
      }
      prevHasSelection = hasSelection;
    });
    return () => sub.unsubscribe();
  }, [enabled, opsAddress, scene, publishOp]);

  // Track remote activity per panel — used by CollabPanelBorder to show who's editing
  // When we receive a remote op with a lockTarget, record it with a TTL.
  // This replaces the lock/unlock protocol which doesn't work with the noop service.

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
              debugLog('Channel connected', { dashboardUID });
              setConnected(true);
              // Parse initial session info from subscribe data
              if (event.message) {
                // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- status event message carries SessionInfo from the server
                const info = event.message as SessionInfo;
                const sessionUsers = info.users ?? [];
                const sessionLocks = info.locks ?? {};
                debugLog('Session info received', { users: sessionUsers.length, locks: Object.keys(sessionLocks).length, seq: info.seq });
                setUsers(sessionUsers);
                setLocks(
                  Object.entries(sessionLocks).map(([target, userId]) => ({ target, userId }))
                );
              }
            } else if (
              event.state === LiveChannelConnectionState.Disconnected ||
              event.state === LiveChannelConnectionState.Shutdown
            ) {
              debugLog('Channel disconnected', { state: event.state, dashboardUID });
              setConnected(false);
            }
          }

          // Message events are ServerMessages (ops, locks, etc.)
          if (isLiveChannelMessageEvent(event)) {
            const msg = event.message;
            debugLog('Raw message received', JSON.parse(JSON.stringify(msg)));

            if (msg.kind === 'op' && clientRef.current) {
              // Read userId from the op payload (server wrapping doesn't reach us via Centrifuge)
              const opPayload = asRecord(msg.op);
              const opUserId = String(opPayload?.userId ?? msg.userId ?? '');
              const lockTarget = typeof opPayload?.lockTarget === 'string' ? opPayload.lockTarget : undefined;

              debugLog('Op received', { userId: opUserId, seq: msg.seq, lockTarget });

              if (opUserId) {
                lastOpByUserRef.current.set(opUserId, Date.now());
              }

              // Activity-based lock: show border for panel being edited by remote user
              if (lockTarget && opUserId && opUserId !== localUserIdRef.current) {
                debugLog('Remote activity on panel', { target: lockTarget, userId: opUserId });
                setLocks((prev) => {
                  const filtered = prev.filter((l) => l.target !== lockTarget);
                  return [...filtered, { target: lockTarget, userId: opUserId }];
                });
                // Auto-clear after 5 seconds of no activity on this target
                const clearTimer = setTimeout(() => {
                  setLocks((prev) => prev.filter((l) => !(l.target === lockTarget && l.userId === opUserId)));
                }, 5000);
                // Clear previous timer for same target
                const timerKey = `${lockTarget}:${opUserId}`;
                const prevTimer = lockTimersRef.current.get(timerKey);
                if (prevTimer !== undefined) {
                  clearTimeout(prevTimer);
                }
                lockTimersRef.current.set(timerKey, clearTimer);
              }

              applyRemoteOp(msg, clientRef.current, localUserIdRef.current, opUserId).catch((err) => {
                console.error('[collab] Failed to apply remote op:', err);
              });
            }

            // Handle unlock messages — immediately clear border for that panel
            if (msg.kind === 'unlock') {
              const unlockPayload = asRecord(msg.op);
              const unlockTarget = typeof unlockPayload?.target === 'string' ? unlockPayload.target : undefined;
              const unlockUserId = typeof unlockPayload?.userId === 'string' ? unlockPayload.userId : undefined;
              if (unlockTarget && unlockUserId && unlockUserId !== localUserIdRef.current) {
                debugLog('Unlock received — clearing border', { target: unlockTarget, userId: unlockUserId });
                setLocks((prev) => prev.filter((l) => l.target !== unlockTarget));
                // Also clear any pending auto-clear timer
                const timerKey = `${unlockTarget}:${unlockUserId}`;
                const prevTimer = lockTimersRef.current.get(timerKey);
                if (prevTimer !== undefined) {
                  clearTimeout(prevTimer);
                  lockTimersRef.current.delete(timerKey);
                }
              }
            }

            // Ignore lock protocol messages with noop service — using activity-based locks instead
            if (msg.kind === 'lock') {
              debugLog('Lock protocol message ignored (using activity-based locks)', { op: msg.op });
            }

            if (msg.kind === 'presence') {
              // Presence events update user list — server sends full user list on presence changes
              const presenceUsers = msg.op;
              if (Array.isArray(presenceUsers)) {
                // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- runtime Array.isArray check guarantees shape
                const typedUsers = presenceUsers as CollabUser[];
                debugLog('Presence update', { userCount: typedUsers.length, users: typedUsers.map((u) => u.displayName) });
                setUsers(typedUsers);
              }
            }
          }
        },
        error: (err) => {
          debugLog('Channel error', err);
          setConnected(false);

          // Edge case #2: Dashboard deleted while editing
          const errorType = classifyChannelError(err);
          if (errorType === CHANNEL_ERROR_DASHBOARD_DELETED) {
            notifyApp.warning(
              t('dashboard-collab.error.dashboard-deleted-title', 'Dashboard deleted'),
              t('dashboard-collab.error.dashboard-deleted-message', 'This dashboard has been deleted. Redirecting to home.')
            );
            locationService.push('/');
            return;
          }

          // Edge case #3: Permission revoked mid-session
          if (errorType === CHANNEL_ERROR_PERMISSION_DENIED) {
            notifyApp.warning(
              t('dashboard-collab.error.permission-revoked-title', 'Access revoked'),
              t('dashboard-collab.error.permission-revoked-message', 'You no longer have access to this dashboard.')
            );
            return;
          }

          console.warn('[collab] Ops channel error:', err);
        },
      })
    );

    return () => sub.unsubscribe();
  }, [opsAddress, dashboardUID, notifyApp]);

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
      debugLog('Acquiring lock', { target, userId: localUserIdRef.current });
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
      debugLog('Releasing lock', { target, userId: localUserIdRef.current });
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

  // Send cursor update — paused when tab is hidden (edge case #4)
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
      users,
      locks,
      staleLocks,
      cursors,
      acquireLock,
      releaseLock,
      sendCursor,
      sendCheckpoint,
    }),
    [connected, users, locks, staleLocks, cursors, acquireLock, releaseLock, sendCursor, sendCheckpoint]
  );

  return <CollabContext.Provider value={value}>{children}</CollabContext.Provider>;
}
