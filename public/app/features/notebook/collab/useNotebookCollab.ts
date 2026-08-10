import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { type Unsubscribable } from 'rxjs';

import {
  generateUUID,
  isLiveChannelMessageEvent,
  isLiveChannelStatusEvent,
  type LiveChannelAddress,
  LiveChannelConnectionState,
  LiveChannelScope,
} from '@grafana/data';
import { getGrafanaLiveSrv } from '@grafana/runtime';
import { type Spec as NotebookSpec } from '@grafana/schema/apis/notebook/v2beta1';
import { contextSrv } from 'app/core/services/context_srv';
import { AnnoKeyUpdatedTimestamp, type Resource } from 'app/features/apiserver/types';

import { type ActivityEvent, type CollabMessage, type CollabUser, type RemotePeer } from './types';

const DOC_BROADCAST_DEBOUNCE_MS = 350;
const CURSOR_THROTTLE_MS = 60;
const VIEW_THROTTLE_MS = 250;
const HEARTBEAT_INTERVAL_MS = 8000;
const PEER_EXPIRY_MS = 20000;
const ACTIVITY_FEED_LIMIT = 30;

// Classic Grafana visualization palette — stable, high-contrast colors for collaborators.
const PEER_COLORS = ['#7EB26D', '#EAB839', '#6ED0E0', '#EF843C', '#E24D42', '#1F78C1', '#BA43A9', '#705DA0'];

export interface NotebookCollabApi {
  /**
   * Other sessions currently connected to this notebook (excludes self). Updates on
   * structural changes (join/leave, block focus, viewport) — NOT on every cursor
   * move, so consuming components don't re-render at pointer frequency.
   */
  peers: RemotePeer[];
  /** Latest peers including live cursor positions — for the cursor overlay, which polls. */
  getPeers: () => RemotePeer[];
  /** Recent edit events from everyone (own actions included), newest first. */
  activity: ActivityEvent[];
  /** Call after every local spec change; broadcasts the doc debounced. */
  notifyLocalEdit: () => void;
  /** Call from pointer tracking; broadcasts the cursor throttled. */
  sendCursor: (x: number, y: number, cellKey: string | null) => void;
  /** Call from scroll tracking; broadcasts the viewport cell for follow mode. */
  sendView: (cellKey: string | null) => void;
  /** Announces a labeled edit ("added a text block") to the shared activity feed. */
  sendActivity: (label: string, cellKey?: string) => void;
  /** This session's collaborator color (used for own feed entries). */
  selfColor: string;
  sessionId: string;
}

interface Options {
  uid: string;
  enabled: boolean;
  getSpec: () => NotebookSpec | undefined;
  /** Called when a newer document arrives from a collaborator. */
  onRemoteSpec: (spec: NotebookSpec) => void;
  /**
   * The saved-version timestamp (ms) of the loaded document. Doc broadcasts carry the
   * timestamp of the edit that produced the document — not the send time — so a session
   * holding an older working copy can never clobber a fresher one just by replying later.
   */
  initialDocTs?: number;
}

/** The saved version's timestamp (ms) of a notebook resource, seeding the doc-version clock. */
export function resourceVersionTs(resource?: Resource<NotebookSpec>): number | undefined {
  const stamp = resource?.metadata.annotations?.[AnnoKeyUpdatedTimestamp] ?? resource?.metadata.creationTimestamp;
  const parsed = stamp ? Date.parse(stamp) : NaN;
  return Number.isNaN(parsed) ? undefined : parsed;
}

/**
 * One-shot document broadcast for flows that save over HTTP outside an editor
 * session (add-to-notebook from dashboards/Explore) — open editors of the same
 * notebook apply the fresh document immediately instead of waiting for a reload.
 */
export function broadcastNotebookDoc(uid: string, spec: NotebookSpec) {
  const message: CollabMessage = {
    t: 'doc',
    sid: `oneshot-${generateUUID()}`,
    ts: Date.now(),
    user: {
      login: contextSrv.user.login,
      name: contextSrv.user.name || contextSrv.user.login,
      avatarUrl: contextSrv.user.gravatarUrl,
    },
    spec,
    transient: true,
  };
  getGrafanaLiveSrv()
    .publish({ scope: LiveChannelScope.Grafana, stream: 'notebook', path: `uid/${uid}` }, message)
    .catch(() => {
      // Best-effort: open editors fall back to seeing the change on reload.
    });
}

function colorForSession(sid: string): string {
  let hash = 0;
  for (let i = 0; i < sid.length; i++) {
    hash = (hash * 31 + sid.charCodeAt(i)) | 0;
  }
  return PEER_COLORS[Math.abs(hash) % PEER_COLORS.length];
}

/**
 * Real-time collaboration for one notebook over a Grafana Live channel
 * (`grafana/notebook/uid/<uid>`, relayed by the backend NotebookHandler):
 * presence (who is here), live cursors and last-write-wins doc sync. The
 * notebook API remains the source of truth — this only syncs working copies.
 */
export function useNotebookCollab({ uid, enabled, getSpec, onRemoteSpec, initialDocTs }: Options): NotebookCollabApi {
  const sessionId = useMemo(() => generateUUID(), []);
  const [peers, setPeers] = useState<RemotePeer[]>([]);
  const [activity, setActivity] = useState<ActivityEvent[]>([]);

  const peersRef = useRef(new Map<string, RemotePeer>());
  // Version timestamp of the current working copy: the saved version's timestamp at
  // load, bumped by local edits (to now) and by accepted remote documents (to their ts).
  const docTs = useRef(0);
  if (initialDocTs && docTs.current === 0) {
    docTs.current = initialDocTs;
  }
  const lastCursorSentAt = useRef(0);
  const lastViewSentAt = useRef(0);
  const lastViewCell = useRef<string | null | undefined>(undefined);
  const lastHelloReplyAt = useRef(0);
  const docTimer = useRef<ReturnType<typeof setTimeout>>();

  // Keep latest callbacks in refs so the channel subscription effect only depends on uid/enabled.
  const getSpecRef = useRef(getSpec);
  getSpecRef.current = getSpec;
  const onRemoteSpecRef = useRef(onRemoteSpec);
  onRemoteSpecRef.current = onRemoteSpec;

  const user: CollabUser = useMemo(
    () => ({
      login: contextSrv.user.login,
      name: contextSrv.user.name || contextSrv.user.login,
      avatarUrl: contextSrv.user.gravatarUrl,
    }),
    []
  );

  const address: LiveChannelAddress = useMemo(
    () => ({ scope: LiveChannelScope.Grafana, stream: 'notebook', path: `uid/${uid}` }),
    [uid]
  );

  const publish = useCallback(
    (message: CollabMessage, opts?: { socket?: boolean }) => {
      getGrafanaLiveSrv()
        .publish(address, message, opts?.socket ? { useSocket: true } : undefined)
        .catch(() => {
          // Collaboration is best-effort: a dropped message is recovered by the
          // next heartbeat/doc broadcast, so failures are intentionally silent.
        });
    },
    [address]
  );

  const flushPeers = useCallback(() => {
    setPeers(
      Array.from(peersRef.current.values(), (peer) => ({
        ...peer,
        user: { ...peer.user },
        cursor: peer.cursor ? { ...peer.cursor } : undefined,
      }))
    );
  }, []);

  const touchPeer = useCallback(
    (message: CollabMessage) => {
      const existing = peersRef.current.get(message.sid);
      const peer: RemotePeer = existing ?? {
        sid: message.sid,
        user: message.user,
        color: colorForSession(message.sid),
        lastSeen: Date.now(),
      };
      peer.lastSeen = Date.now();
      peer.user = message.user;

      // Re-rendering consumers at cursor frequency (~16/s per peer) can saturate the
      // main thread on large notebooks, so pure position updates only mutate the ref
      // (polled by the cursor overlay). State flushes are reserved for structural
      // changes: new peers, block focus changes and viewport moves.
      let structural = !existing;
      if (message.t === 'cursor') {
        peer.cursor = { x: message.x, y: message.y, ts: Date.now() };
        if (peer.cellKey !== message.cellKey) {
          peer.cellKey = message.cellKey;
          structural = true;
        }
      }
      if (message.t === 'view' && peer.viewCell !== message.cellKey) {
        peer.viewCell = message.cellKey;
        structural = true;
      }
      peersRef.current.set(message.sid, peer);
      if (structural) {
        flushPeers();
      }
    },
    [flushPeers]
  );

  const appendActivity = useCallback((event: ActivityEvent) => {
    setActivity((current) => [event, ...current].slice(0, ACTIVITY_FEED_LIMIT));
  }, []);

  const broadcastDocNow = useCallback(() => {
    const spec = getSpecRef.current();
    if (!spec) {
      return;
    }
    // ts is the document's version timestamp, never the send time: replying to a
    // hello with an old working copy must not out-rank fresher documents.
    publish({ t: 'doc', sid: sessionId, ts: docTs.current || Date.now(), user, spec });
  }, [publish, sessionId, user]);

  useEffect(() => {
    if (!enabled || !uid) {
      return;
    }

    let subscription: Unsubscribable | undefined;
    const live = getGrafanaLiveSrv();
    const peersAtSubscribe = peersRef.current;

    subscription = live.getStream<CollabMessage>(address).subscribe({
      next: (event) => {
        if (isLiveChannelStatusEvent(event) && event.state === LiveChannelConnectionState.Connected) {
          publish({ t: 'hello', sid: sessionId, ts: Date.now(), user });
          return;
        }

        if (!isLiveChannelMessageEvent(event)) {
          return;
        }
        const message = event.message;
        if (!message || typeof message !== 'object' || !('sid' in message) || message.sid === sessionId) {
          return;
        }

        switch (message.t) {
          case 'hello': {
            touchPeer(message);
            // Announce ourselves and share our working copy so the newcomer converges.
            // Throttled: several peers replying in the same window is fine, the newest ts wins.
            if (Date.now() - lastHelloReplyAt.current > 2000) {
              lastHelloReplyAt.current = Date.now();
              publish({ t: 'hello', sid: sessionId, ts: Date.now(), user });
              broadcastDocNow();
            }
            break;
          }
          case 'doc': {
            if (!message.transient) {
              touchPeer(message);
            }
            // Last write wins on document-version timestamps: apply only when the
            // remote document is strictly newer than ours (concurrently-typed local
            // cells are protected by the editor's merge). Equal timestamps mean both
            // sessions hold the same saved version — nothing to converge.
            if (message.ts > docTs.current) {
              docTs.current = message.ts;
              onRemoteSpecRef.current(message.spec);
            }
            break;
          }
          case 'cursor': {
            touchPeer(message);
            break;
          }
          case 'view': {
            touchPeer(message);
            break;
          }
          case 'activity': {
            touchPeer(message);
            appendActivity({
              id: `${message.sid}-${message.ts}`,
              sid: message.sid,
              user: message.user,
              color: colorForSession(message.sid),
              label: message.label,
              cellKey: message.cellKey,
              ts: message.ts,
            });
            break;
          }
          case 'bye': {
            peersRef.current.delete(message.sid);
            flushPeers();
            break;
          }
        }
      },
    });

    const heartbeat = setInterval(() => {
      publish({ t: 'hello', sid: sessionId, ts: Date.now(), user });

      let changed = false;
      for (const [sid, peer] of peersRef.current) {
        if (Date.now() - peer.lastSeen > PEER_EXPIRY_MS) {
          peersRef.current.delete(sid);
          changed = true;
        }
      }
      if (changed) {
        flushPeers();
      }
    }, HEARTBEAT_INTERVAL_MS);

    return () => {
      publish({ t: 'bye', sid: sessionId, ts: Date.now(), user });
      clearInterval(heartbeat);
      clearTimeout(docTimer.current);
      subscription?.unsubscribe();
      peersAtSubscribe.clear();
      setPeers([]);
    };
  }, [address, enabled, uid, publish, sessionId, user, touchPeer, flushPeers, broadcastDocNow, appendActivity]);

  const notifyLocalEdit = useCallback(() => {
    docTs.current = Date.now();
    if (!enabled) {
      return;
    }
    clearTimeout(docTimer.current);
    docTimer.current = setTimeout(broadcastDocNow, DOC_BROADCAST_DEBOUNCE_MS);
  }, [enabled, broadcastDocNow]);

  const sendCursor = useCallback(
    (x: number, y: number, cellKey: string | null) => {
      if (!enabled) {
        return;
      }
      const now = Date.now();
      if (now - lastCursorSentAt.current < CURSOR_THROTTLE_MS) {
        return;
      }
      lastCursorSentAt.current = now;
      // Cursor updates ride the websocket: they are high-frequency and lossy by nature.
      publish(
        { t: 'cursor', sid: sessionId, ts: now, user, x: Math.round(x), y: Math.round(y), cellKey },
        { socket: true }
      );
    },
    [enabled, publish, sessionId, user]
  );

  const sendView = useCallback(
    (cellKey: string | null) => {
      if (!enabled) {
        return;
      }
      const now = Date.now();
      // Skip unchanged positions and rate-limit: followers only need transitions.
      if (cellKey === lastViewCell.current || now - lastViewSentAt.current < VIEW_THROTTLE_MS) {
        return;
      }
      lastViewCell.current = cellKey;
      lastViewSentAt.current = now;
      publish({ t: 'view', sid: sessionId, ts: now, user, cellKey }, { socket: true });
    },
    [enabled, publish, sessionId, user]
  );

  const selfColor = useMemo(() => colorForSession(sessionId), [sessionId]);

  const sendActivity = useCallback(
    (label: string, cellKey?: string) => {
      const ts = Date.now();
      // Own actions appear in the local feed immediately; peers get them over Live.
      appendActivity({ id: `${sessionId}-${ts}`, sid: sessionId, user, color: selfColor, label, cellKey, ts });
      if (enabled) {
        publish({ t: 'activity', sid: sessionId, ts, user, label, cellKey });
      }
    },
    [enabled, publish, sessionId, user, selfColor, appendActivity]
  );

  const getPeers = useCallback(() => Array.from(peersRef.current.values()), []);

  return { peers, getPeers, activity, notifyLocalEdit, sendCursor, sendView, sendActivity, selfColor, sessionId };
}
