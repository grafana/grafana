/**
 * React hook for real-time CRDT synchronization via Grafana Live
 *
 * This hook connects to the Grafana Live WebSocket channel for a map
 * and handles bidirectional operation synchronization.
 */

import { useEffect, useRef, useState } from 'react';
import { Unsubscribable } from 'rxjs';

import { LiveChannelAddress, LiveChannelScope, isLiveChannelMessageEvent } from '@grafana/data';
import { getGrafanaLiveSrv } from '@grafana/runtime';
import { StoreState, useDispatch, useSelector } from 'app/types/store';

import { CRDTOperation } from '../crdt/types';
import { OperationQueue } from '../operations/queue';
import { applyOperation, clearPendingOperations, setOnlineStatus } from '../state/crdtSlice';
import { selectPendingOperations, selectNodeId } from '../state/selectors';

export interface RealtimeSyncOptions {
  mapUid: string;
  enabled?: boolean;
  onError?: (error: Error) => void;
  onConnected?: () => void;
  onDisconnected?: () => void;
}

export interface RealtimeSyncStatus {
  isConnected: boolean;
  isInitialized: boolean;
  error?: Error;
}

/**
 * Hook to synchronize CRDT state with Grafana Live
 */
export function useRealtimeSync(options: RealtimeSyncOptions): RealtimeSyncStatus {
  const { mapUid, enabled = true, onError, onConnected, onDisconnected } = options;

  const dispatch = useDispatch();
  const nodeId = useSelector((state: StoreState) => selectNodeId(state.exploreMapCRDT));
  const pendingOperations = useSelector((state: StoreState) => selectPendingOperations(state.exploreMapCRDT));

  const [status, setStatus] = useState<RealtimeSyncStatus>({
    isConnected: false,
    isInitialized: false,
  });

  const subscriptionRef = useRef<Unsubscribable | null>(null);
  const queueRef = useRef<OperationQueue>(new OperationQueue(nodeId));
  const appliedOpsRef = useRef<Set<string>>(new Set());
  const channelAddressRef = useRef<LiveChannelAddress | null>(null);

  useEffect(() => {
    if (!enabled || !mapUid) {
      return;
    }

    let isSubscribed = true;

    const connect = () => {
      try {
        const liveService = getGrafanaLiveSrv();
        if (!liveService) {
          throw new Error('Grafana Live service not available');
        }

        // Create channel address for explore-map
        const channelAddress: LiveChannelAddress = {
          scope: LiveChannelScope.Grafana,
          namespace: 'explore-map',
          path: mapUid,
        };

        channelAddressRef.current = channelAddress;

        // Subscribe to the channel stream
        const subscription = liveService.getStream<CRDTOperation>(channelAddress).subscribe({
          next: (event) => {
            if (!isSubscribed) {
              return;
            }

            try {
              // Handle message events
              if (isLiveChannelMessageEvent(event)) {
                const operation: CRDTOperation = event.message;

                // Skip if this is our own operation
                if (operation.nodeId === nodeId) {
                  return;
                }

                // Skip if already applied
                if (appliedOpsRef.current.has(operation.operationId)) {
                  return;
                }

                // Add to queue and apply
                const added = queueRef.current.addRemoteOperation(operation);
                if (added) {
                  appliedOpsRef.current.add(operation.operationId);
                  dispatch(applyOperation({ operation }));
                }
              }
            } catch (error) {
              console.error('[CRDT] Failed to handle incoming operation:', error);
              if (onError && error instanceof Error) {
                onError(error);
              }
            }
          },
          error: (error) => {
            console.error('[CRDT] Channel error:', error);
            setStatus((prev) => ({
              ...prev,
              isConnected: false,
              error: error instanceof Error ? error : new Error(String(error)),
            }));

            dispatch(setOnlineStatus({ isOnline: false }));

            if (onError && error instanceof Error) {
              onError(error);
            }
            if (onDisconnected) {
              onDisconnected();
            }
          },
          complete: () => {
            if (isSubscribed) {
              setStatus((prev) => ({ ...prev, isConnected: false }));
              dispatch(setOnlineStatus({ isOnline: false }));
              if (onDisconnected) {
                onDisconnected();
              }
            }
          },
        });

        subscriptionRef.current = subscription;

        // Mark as connected
        setStatus({
          isConnected: true,
          isInitialized: true,
          error: undefined,
        });

        dispatch(setOnlineStatus({ isOnline: true }));

        if (onConnected) {
          onConnected();
        }
      } catch (error) {
        console.error('[CRDT] Failed to connect to Live channel:', error);
        setStatus({
          isConnected: false,
          isInitialized: true,
          error: error instanceof Error ? error : new Error(String(error)),
        });

        if (onError && error instanceof Error) {
          onError(error);
        }
      }
    };

    connect();

    return () => {
      isSubscribed = false;
      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe();
        subscriptionRef.current = null;
      }
      channelAddressRef.current = null;
    };
  }, [mapUid, enabled, nodeId, dispatch, onError, onConnected, onDisconnected]);

  // Broadcast pending operations
  useEffect(() => {
    if (!status.isConnected || !channelAddressRef.current || !pendingOperations || pendingOperations.length === 0) {
      return;
    }

    const liveService = getGrafanaLiveSrv();
    if (!liveService) {
      console.error('[CRDT] Live service not available');
      return;
    }

    const channelAddress = channelAddressRef.current;

    console.log('[CRDT] Broadcasting', pendingOperations.length, 'pending operations');

    // Broadcast each pending operation
    for (const operation of pendingOperations) {
      try {
        // Mark as applied locally
        appliedOpsRef.current.add(operation.operationId);

        console.log('[CRDT] Broadcasting operation:', operation.type, operation.operationId);

        // Publish to channel
        liveService.publish(channelAddress, operation).catch((error) => {
          console.error('[CRDT] Failed to broadcast operation:', error);
        });
      } catch (error) {
        console.error('[CRDT] Failed to broadcast operation:', error);
      }
    }

    // Clear pending operations after broadcast
    dispatch(clearPendingOperations());
  }, [pendingOperations, status.isConnected, dispatch]);

  return status;
}
