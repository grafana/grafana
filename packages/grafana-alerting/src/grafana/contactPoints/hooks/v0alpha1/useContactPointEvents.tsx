import { useCallback, useEffect, useRef } from 'react';

import type { ContactPoint } from '../../../api/v0alpha1/types';

type ContactPointEvent =
  | {
      type: 'contactPoint:added';
      payload: ContactPoint;
    }
  | {
      type: 'contactPoint:updated';
      payload: ContactPoint;
    }
  | {
      type: 'contactPoint:deleted';
      payload: { name: string };
    };

type ContactPointEventHandlers = {
  onAdded?: (contactPoint: ContactPoint) => void;
  onUpdated?: (contactPoint: ContactPoint) => void;
  onDeleted?: (contactPointName: string) => void;
};

const CHANNEL_NAME = 'alerting:-contact-points-events';

export function useContactPointEvents(handlers: ContactPointEventHandlers = {}) {
  const channelRef = useRef<BroadcastChannel | null>(null);
  const { onAdded, onUpdated, onDeleted } = handlers;

  function getChannel(): BroadcastChannel {
    if (!channelRef.current) {
      channelRef.current = new BroadcastChannel(CHANNEL_NAME);
    }

    return channelRef.current;
  }

  useEffect(() => {
    const channel = getChannel();

    // Handler for both local and cross-tab events
    const handleEvent = (event: ContactPointEvent) => {
      const { type, payload } = event;

      switch (type) {
        case 'contactPoint:added':
          onAdded?.(payload);
          break;
        case 'contactPoint:updated':
          onUpdated?.(payload);
          break;
        case 'contactPoint:deleted':
          onDeleted?.(payload.name);
          break;
      }
    };

    // Handler for cross-tab events via BroadcastChannel
    const handleMessage = (event: MessageEvent<ContactPointEvent>) => {
      handleEvent(event.data);
    };

    if (channel) {
      channel.addEventListener('message', handleMessage);
    }

    return () => {
      // Cleanup cross-tab event handler
      if (channel) {
        channel.removeEventListener('message', handleMessage);
        channel.close();
      }
    };
  }, [onAdded, onUpdated, onDeleted]);

  return channelRef;
}

export function useProvideContactPointEvents() {
  const channelRef = useRef<BroadcastChannel | null>(null);

  function getChannel(): BroadcastChannel {
    if (!channelRef.current) {
      channelRef.current = new BroadcastChannel(CHANNEL_NAME);
    }

    return channelRef.current;
  }

  useEffect(() => {
    const channel = getChannel();

    return () => {
      channel.close();
    };
  }, []);

  const publishEvent = useCallback((event: ContactPointEvent) => {
    const channel = getChannel();
    channel.postMessage(event);
  }, []);

  const publishAdded = useCallback(
    (contactPoint: ContactPoint) => {
      publishEvent({ type: 'contactPoint:added', payload: contactPoint });
    },
    [publishEvent]
  );

  const publishUpdated = useCallback(
    (contactPoint: ContactPoint) => {
      publishEvent({ type: 'contactPoint:updated', payload: contactPoint });
    },
    [publishEvent]
  );

  const publishDeleted = useCallback(
    (contactPointName: string) => {
      publishEvent({ type: 'contactPoint:deleted', payload: { name: contactPointName } });
    },
    [publishEvent]
  );

  return {
    publishAdded,
    publishUpdated,
    publishDeleted,
    channel: channelRef,
  };
}
