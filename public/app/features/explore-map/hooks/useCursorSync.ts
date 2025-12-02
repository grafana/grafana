/**
 * React hook for real-time cursor synchronization via Grafana Live
 *
 * This hook handles sending and receiving cursor position updates
 * for collaborative cursor sharing across all active sessions.
 */

import { throttle } from 'lodash';
import { useCallback, useEffect, useRef } from 'react';
import { Unsubscribable } from 'rxjs';

import { LiveChannelAddress, LiveChannelScope, isLiveChannelMessageEvent } from '@grafana/data';
import { getGrafanaLiveSrv } from '@grafana/runtime';
import { StoreState, useDispatch, useSelector } from 'app/types/store';

import { updateCursor, removeCursor } from '../state/crdtSlice';
import { selectSessionId } from '../state/selectors';
import { UserCursor } from '../state/types';

export interface CursorSyncOptions {
  mapUid: string;
  enabled?: boolean;
  throttleMs?: number;
}

interface CursorUpdateMessage {
  type: 'cursor_update';
  sessionId: string;
  userId: string;
  userName: string;
  data: {
    x: number;
    y: number;
    color: string;
    selectedPanelIds: string[];
  };
  timestamp: number;
}

interface CursorLeaveMessage {
  type: 'cursor_leave';
  sessionId: string;
  userId: string;
  userName: string;
  timestamp: number;
}

type CursorMessage = CursorUpdateMessage | CursorLeaveMessage;

/**
 * Hook to synchronize cursor positions with Grafana Live
 */
export function useCursorSync(options: CursorSyncOptions) {
  const { mapUid, enabled = true, throttleMs = 50 } = options;

  const dispatch = useDispatch();
  const sessionId = useSelector((state: StoreState) => selectSessionId(state.exploreMapCRDT));

  const subscriptionRef = useRef<Unsubscribable | null>(null);
  const channelAddressRef = useRef<LiveChannelAddress | null>(null);
  const cursorColorRef = useRef<string>(generateRandomColor());

  // Send cursor leave message
  const sendCursorLeave = useCallback(() => {
    if (!channelAddressRef.current) {
      return;
    }

    const liveService = getGrafanaLiveSrv();
    if (!liveService) {
      return;
    }

    const message: CursorLeaveMessage = {
      type: 'cursor_leave',
      sessionId,
      userId: '', // Will be enriched by backend
      userName: '', // Will be enriched by backend
      timestamp: Date.now(),
    };

    liveService.publish(channelAddressRef.current, message, { useSocket: true }).catch(() => {
      // Failed to send cursor leave - ignore silently
    });
  }, [sessionId]);

  // Initialize channel connection
  useEffect(() => {
    if (!enabled || !mapUid) {
      return;
    }

    let isSubscribed = true;

    const connect = () => {
      try {
        const liveService = getGrafanaLiveSrv();
        if (!liveService) {
          return;
        }

        // Create channel address for explore-map
        const channelAddress: LiveChannelAddress = {
          scope: LiveChannelScope.Grafana,
          namespace: 'explore-map',
          path: mapUid,
        };

        channelAddressRef.current = channelAddress;

        // Subscribe to the channel stream
        const subscription = liveService.getStream<CursorMessage>(channelAddress).subscribe({
          next: (event) => {
            if (!isSubscribed) {
              return;
            }

            try {
              // Handle cursor message events
              if (isLiveChannelMessageEvent(event)) {
                const message: CursorMessage = event.message;

                // Skip our own messages (backend should filter, but double-check)
                if (message.sessionId === sessionId) {
                  return;
                }

                if (message.type === 'cursor_update') {
                  const cursor: UserCursor = {
                    userId: message.userId,
                    sessionId: message.sessionId,
                    userName: message.userName,
                    color: message.data.color,
                    x: message.data.x,
                    y: message.data.y,
                    lastUpdated: message.timestamp,
                    selectedPanelIds: message.data.selectedPanelIds || [],
                  };
                  dispatch(updateCursor(cursor));
                } else if (message.type === 'cursor_leave') {
                  dispatch(removeCursor({ sessionId: message.sessionId }));
                }
              }
            } catch (error) {
              // Silently ignore parsing errors
            }
          },
          error: () => {
            // Channel error - connection will be retried automatically
          },
        });

        subscriptionRef.current = subscription;
      } catch (error) {
        // Failed to connect - will retry on next mount
      }
    };

    connect();

    return () => {
      isSubscribed = false;

      // Send cursor leave message before disconnecting
      if (channelAddressRef.current) {
        sendCursorLeave();
      }

      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe();
        subscriptionRef.current = null;
      }
      channelAddressRef.current = null;
    };
  }, [mapUid, enabled, sessionId, dispatch, sendCursorLeave]);

  // Throttled cursor update function
  const sendCursorUpdate = useRef(
    throttle((x: number, y: number, selectedPanelIds: string[]) => {
      if (!channelAddressRef.current) {
        return;
      }

      const liveService = getGrafanaLiveSrv();
      if (!liveService) {
        return;
      }

      const message: CursorUpdateMessage = {
        type: 'cursor_update',
        sessionId,
        userId: '', // Will be enriched by backend
        userName: '', // Will be enriched by backend
        data: {
          x,
          y,
          color: cursorColorRef.current,
          selectedPanelIds,
        },
        timestamp: Date.now(),
      };

      liveService.publish(channelAddressRef.current, message, { useSocket: true }).catch(() => {
        // Failed to send cursor update - ignore silently
      });
    }, throttleMs)
  ).current;

  // Update cursor position (throttled)
  const updatePosition = useCallback(
    (x: number, y: number, selectedPanelIds: string[]) => {
      sendCursorUpdate(x, y, selectedPanelIds);
    },
    [sendCursorUpdate]
  );

  // Force send cursor update immediately (not throttled) - used for selection changes
  const updatePositionImmediate = useCallback(
    (x: number, y: number, selectedPanelIds: string[]) => {
      if (!channelAddressRef.current) {
        return;
      }

      const liveService = getGrafanaLiveSrv();
      if (!liveService) {
        return;
      }

      const message: CursorUpdateMessage = {
        type: 'cursor_update',
        sessionId,
        userId: '', // Will be enriched by backend
        userName: '', // Will be enriched by backend
        data: {
          x,
          y,
          color: cursorColorRef.current,
          selectedPanelIds,
        },
        timestamp: Date.now(),
      };

      liveService.publish(channelAddressRef.current, message, { useSocket: true }).catch(() => {
        // Failed to send cursor update - ignore silently
      });
    },
    [sessionId]
  );

  return {
    updatePosition,
    updatePositionImmediate,
    color: cursorColorRef.current,
  };
}

/**
 * Generate a random color for cursor
 */
function generateRandomColor(): string {
  const colors = [
    '#FF6B6B', // Red
    '#4ECDC4', // Teal
    '#45B7D1', // Blue
    '#FFA07A', // Orange
    '#98D8C8', // Mint
    '#F7DC6F', // Yellow
    '#BB8FCE', // Purple
    '#85C1E2', // Sky Blue
    '#F8B739', // Amber
    '#52C1B9', // Turquoise
  ];
  return colors[Math.floor(Math.random() * colors.length)];
}
