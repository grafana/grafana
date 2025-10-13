import { useEffect, useState } from 'react';

import { BusEvent, BusEventType, EventBus } from '@grafana/data';

/**
  A bit more efficient than using useObservable(eventBus.getStream(MyEventType)) as that will create a new Observable and subscription every render
 */
export function useBusEvent<T extends BusEvent>(eventBus: EventBus, eventType: BusEventType<T>): T | undefined {
  const [event, setEvent] = useState<T | undefined>();

  useEffect(() => {
    const sub = eventBus.subscribe(eventType, setEvent);
    return () => sub.unsubscribe();
  }, [eventBus, eventType]);

  return event;
}
