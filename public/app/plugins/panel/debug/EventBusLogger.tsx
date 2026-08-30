import { memo, useEffect, useState } from 'react';
import { type PartialObserver, type Unsubscribable } from 'rxjs';

import { type BusEvent, DataHoverEvent, DataHoverClearEvent, DataSelectEvent, type EventBus } from '@grafana/data';
import { CustomScrollbar } from '@grafana/ui';

interface Props {
  eventBus: EventBus;
}

interface BusEventEx {
  key: number;
  type: string;
  path: string;
  payload: any;
}
let counter = 100;

export const EventBusLoggerPanel = memo(({ eventBus }: Props) => {
  const [history, setHistory] = useState<BusEventEx[]>([]);

  useEffect(() => {
    const eventObserver: PartialObserver<BusEvent> = {
      next: (event: BusEvent) => {
        const origin: any = event.origin;
        const busEvent: BusEventEx = {
          key: counter++,
          type: event.type,
          path: origin?.path,
          payload: event.payload,
        };
        // only show the last 40 events
        setHistory((prev) => [busEvent, ...prev].slice(0, 40));
      },
    };

    const subs: Unsubscribable[] = [];
    subs.push(eventBus.getStream(DataHoverEvent).subscribe(eventObserver));
    subs.push(eventBus.getStream(DataHoverClearEvent).subscribe(eventObserver));
    subs.push(eventBus.getStream(DataSelectEvent).subscribe(eventObserver));

    return () => {
      for (const sub of subs) {
        sub.unsubscribe();
      }
    };
  }, [eventBus]);

  return (
    <CustomScrollbar autoHeightMin="100%" autoHeightMax="100%">
      {history.map((v) => (
        // eslint-disable-next-line @grafana/i18n/no-untranslated-strings
        <div key={v.key}>
          {JSON.stringify(v.path)} {v.type} / X:{JSON.stringify(v.payload.x)} / Y:{JSON.stringify(v.payload.y)}
        </div>
      ))}
    </CustomScrollbar>
  );
});

EventBusLoggerPanel.displayName = 'EventBusLoggerPanel';
