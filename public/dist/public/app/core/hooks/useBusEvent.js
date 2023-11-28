import { useEffect, useState } from 'react';
/**
  A bit more efficient than using useObservable(eventBus.getStream(MyEventType)) as that will create a new Observable and subscription every render
 */
export function useBusEvent(eventBus, eventType) {
    const [event, setEvent] = useState();
    useEffect(() => {
        const sub = eventBus.subscribe(eventType, setEvent);
        return () => sub.unsubscribe();
    }, [eventBus, eventType]);
    return event;
}
//# sourceMappingURL=useBusEvent.js.map