/* eslint-disable @typescript-eslint/consistent-type-assertions */
/**
 * React hook to track active users for a specific map
 * 
 * This hook subscribes to Grafana Live cursor updates for a map
 * and returns the list of currently active users.
 * 
 * If updateRedux is true, it also updates the Redux state so that
 * the toolbar selector can see these users when viewing this map.
 */

import { useEffect, useRef, useState } from 'react';
import { Unsubscribable } from 'rxjs';

import { LiveChannelAddress, LiveChannelScope, isLiveChannelMessageEvent, store } from '@grafana/data';
import { getGrafanaLiveSrv } from '@grafana/runtime';
import { UserView } from '@grafana/ui';
import { useDispatch } from 'app/types/store';

import { updateCursor, removeCursor } from '../state/crdtSlice';
import { UserCursor } from '../state/types';

interface CursorUpdateMessage {
  type: 'cursor_update';
  sessionId: string;
  userId: string;
  userName: string;
  data: {
    x: number;
    y: number;
    color: string;
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

const STALE_THRESHOLD_MS = 15 * 60 * 1000; // 15 minutes
const MAX_HISTORY_MS = 24 * 60 * 60 * 1000; // 24 hours - keep user history for this long
const STORAGE_KEY_PREFIX = 'grafana.exploreMap.users.';

// Helper to get localStorage key for a map
const getStorageKey = (mapUid: string) => `${STORAGE_KEY_PREFIX}${mapUid}`;

// Load user history from storage
const loadUserHistoryFromStorage = (mapUid: string): Map<string, { userId: string; userName: string; lastUpdated: number }> => {
  try {
    const key = getStorageKey(mapUid);
    const stored = store.get(key);
    if (!stored) {
      return new Map();
    }

    const data = typeof stored === 'string' ? JSON.parse(stored) : stored;
    const now = Date.now();
    const history = new Map<string, { userId: string; userName: string; lastUpdated: number }>();

    // Only load users active in the last 15 minutes
    for (const [userId, userData] of Object.entries(data)) {
      const user = userData as { userId: string; userName: string; lastUpdated: number };
      if (now - user.lastUpdated <= STALE_THRESHOLD_MS) {
        history.set(userId, user);
      }
    }

    return history;
  } catch (error) {
    console.warn('Failed to load user history from storage:', error);
    return new Map();
  }
};

// Save user history to storage
const saveUserHistoryToStorage = (mapUid: string, history: Map<string, { userId: string; userName: string; lastUpdated: number }>) => {
  try {
    const key = getStorageKey(mapUid);
    const data: Record<string, { userId: string; userName: string; lastUpdated: number }> = {};
    
    for (const [userId, user] of history.entries()) {
      data[userId] = user;
    }

    store.set(key, JSON.stringify(data));
  } catch (error) {
    console.warn('Failed to save user history to storage:', error);
  }
};

export function useMapActiveUsers(
  mapUid: string | undefined,
  enabled = true,
  updateRedux = false,
  showAllUsers = false
): UserView[] {
  const [activeUsers, setActiveUsers] = useState<UserView[]>([]);
  const subscriptionRef = useRef<Unsubscribable | null>(null);
  // Track all users who have been active, even after they disconnect
  const usersHistoryRef = useRef<Map<string, { userId: string; userName: string; lastUpdated: number }>>(new Map());
  const dispatch = useDispatch();

  useEffect(() => {
    if (!enabled || !mapUid) {
      setActiveUsers([]);
      return;
    }

    // Load user history from storage when mapUid changes
    usersHistoryRef.current = loadUserHistoryFromStorage(mapUid);

    // If updateRedux is true, populate Redux state with loaded history
    // This ensures the toolbar shows users immediately on page load
    if (updateRedux) {
      const now = Date.now();
      for (const user of usersHistoryRef.current.values()) {
        // Only add users active within the threshold
        if (now - user.lastUpdated <= STALE_THRESHOLD_MS) {
          // Create a synthetic cursor for Redux state
          // Use userId as sessionId with a suffix to indicate it's from history
          const cursor: UserCursor = {
            userId: user.userId,
            sessionId: `${user.userId}-history`,
            userName: user.userName,
            color: '#4ECDC4', // Default color
            x: 0,
            y: 0,
            lastUpdated: user.lastUpdated,
          };
          dispatch(updateCursor(cursor));
        }
      }
    }

    let isSubscribed = true;

    const updateActiveUsers = () => {
      const now = Date.now();
      const userMap = new Map<string, { userId: string; userName: string; lastUpdated: number }>();

      // Process all users from history
      for (const user of usersHistoryRef.current.values()) {
        // Remove users older than MAX_HISTORY_MS
        if (now - user.lastUpdated > MAX_HISTORY_MS) {
          usersHistoryRef.current.delete(user.userId);
          continue;
        }

        // If showAllUsers is false, filter out stale users (older than threshold)
        if (!showAllUsers && now - user.lastUpdated > STALE_THRESHOLD_MS) {
          continue;
        }

        // Keep the most recent entry for each user
        const existing = userMap.get(user.userId);
        if (!existing || user.lastUpdated > existing.lastUpdated) {
          userMap.set(user.userId, user);
        }
      }

      // Save updated history to storage (clean up old entries)
      saveUserHistoryToStorage(mapUid, usersHistoryRef.current);

      // Convert to UserView format
      const users = Array.from(userMap.values())
        .map((user) => ({
          user: {
            name: user.userName,
          },
          lastActiveAt: new Date(user.lastUpdated).toISOString(),
        }))
        .sort((a, b) => new Date(b.lastActiveAt).getTime() - new Date(a.lastActiveAt).getTime());

      setActiveUsers(users);
    };

    // Update active users immediately with loaded history
    updateActiveUsers();

    const connect = () => {
      try {
        const liveService = getGrafanaLiveSrv();
        if (!liveService) {
          return;
        }

        const channelAddress: LiveChannelAddress = {
          scope: LiveChannelScope.Grafana,
          namespace: 'explore-map',
          path: mapUid,
        };

        const subscription = liveService.getStream<CursorMessage>(channelAddress).subscribe({
          next: (event) => {
            if (!isSubscribed) {
              return;
            }

            try {
              if (isLiveChannelMessageEvent(event)) {
                const message = event.message as CursorMessage;

                if (message.type === 'cursor_update') {
                  // Update user history (persist even after disconnect)
                  usersHistoryRef.current.set(message.userId, {
                    userId: message.userId,
                    userName: message.userName,
                    lastUpdated: message.timestamp,
                  });

                  // Save to localStorage periodically (debounced)
                  saveUserHistoryToStorage(mapUid, usersHistoryRef.current);

                  // Update Redux state if requested (for toolbar visibility)
                  if (updateRedux) {
                    const cursor: UserCursor = {
                      userId: message.userId,
                      sessionId: message.sessionId,
                      userName: message.userName,
                      color: message.data.color,
                      x: message.data.x,
                      y: message.data.y,
                      lastUpdated: message.timestamp,
                    };
                    dispatch(updateCursor(cursor));
                  }
                } else if (message.type === 'cursor_leave') {
                  // Don't remove from history on leave - keep for showing last active
                  // Update Redux state if requested
                  if (updateRedux) {
                    dispatch(removeCursor({ sessionId: message.sessionId }));
                  }
                }

                // Update active users list
                updateActiveUsers();
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

    // Clean up stale cursors periodically
    const cleanupInterval = setInterval(() => {
      updateActiveUsers();
    }, 5000); // Check every 5 seconds

    connect();

    return () => {
      isSubscribed = false;
      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe();
        subscriptionRef.current = null;
      }
      // Don't clear history on unmount - keep it for showing last active users
      // Only clear if explicitly needed (e.g., when mapUid changes)
      clearInterval(cleanupInterval);
    };
  }, [mapUid, enabled, updateRedux, showAllUsers, dispatch]);

  return activeUsers;
}

