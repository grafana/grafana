import { type Observable, NEVER, Subject } from 'rxjs';

import {
  type DataQueryResponse,
  type LiveChannelAddress,
  type LiveChannelEvent,
  type LiveChannelPresenceStatus,
  LiveChannelConnectionState,
  LiveChannelEventType,
} from '@grafana/data';
import type { GrafanaLiveSrv, LiveDataStreamOptions } from '@grafana/runtime';
type ProvisioningResource = 'jobs' | 'repositories' | 'connections';

/**
 * A loose version of ResourceEvent that accepts generated API types
 * (where metadata, spec, etc. are optional) without requiring strict Resource<T>.
 */
interface WatchEvent {
  type: 'ADDED' | 'DELETED' | 'MODIFIED';
  object: Record<string, unknown>;
}

function addressToKey(address: LiveChannelAddress): string {
  return `${address.scope}/${address.stream}/${address.path}`;
}

/**
 * A mock GrafanaLiveSrv that uses RxJS Subjects for controllable streams.
 * Tests can push events into specific channels via `emitWatchEvent` and `emitWatchError`.
 */
export class MockGrafanaLiveSrv implements GrafanaLiveSrv {
  private streams = new Map<string, Subject<LiveChannelEvent>>();

  getConnectionState(): Observable<boolean> {
    return NEVER;
  }

  getStream<T>(address: LiveChannelAddress): Observable<LiveChannelEvent<T>> {
    const key = addressToKey(address);
    if (!this.streams.has(key)) {
      this.streams.set(key, new Subject<LiveChannelEvent>());
    }
    return this.streams.get(key)!.asObservable() as Observable<LiveChannelEvent<T>>;
  }

  getDataStream(_options: LiveDataStreamOptions): Observable<DataQueryResponse> {
    return NEVER;
  }

  getPresence(_address: LiveChannelAddress): Promise<LiveChannelPresenceStatus> {
    return Promise.resolve({} as LiveChannelPresenceStatus);
  }

  publish(_address: LiveChannelAddress, _data: unknown): Promise<unknown> {
    return Promise.resolve(undefined);
  }

  /**
   * Emit a watch event (ADDED, MODIFIED, DELETED) to all matching streams for the given resource.
   * The event is wrapped in a LiveChannelMessageEvent so it flows through the ScopedResourceClient.watch() pipe.
   */
  emitWatchEvent(resource: ProvisioningResource, event: WatchEvent): void {
    const messageEvent: LiveChannelEvent = {
      type: LiveChannelEventType.Message,
      message: event,
    };

    for (const [key, subject] of this.streams) {
      if (key.includes(`/v0alpha1/${resource}`)) {
        subject.next(messageEvent);
      }
    }
  }

  /**
   * Emit a watch error to all matching streams for the given resource.
   * This triggers the error path in ScopedResourceClient.watch() which catches LiveChannelStatusEvents with errors.
   */
  emitWatchError(resource: ProvisioningResource, error: unknown): void {
    const statusEvent: LiveChannelEvent = {
      type: LiveChannelEventType.Status,
      id: `watch/provisioning.grafana.app/${resource}`,
      timestamp: Date.now(),
      state: LiveChannelConnectionState.Disconnected,
      error,
    };

    for (const [key, subject] of this.streams) {
      if (key.includes(`/v0alpha1/${resource}`)) {
        subject.next(statusEvent);
      }
    }
  }

  /**
   * Complete all subjects and clear the map. Call in afterEach to prevent cross-test leakage.
   */
  reset(): void {
    for (const subject of this.streams.values()) {
      subject.complete();
    }
    this.streams.clear();
  }
}
