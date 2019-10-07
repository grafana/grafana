import { useCallback, useEffect, useMemo } from 'react';
import { Observable, Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';

export interface Eventing {
  subscribeToEvents: (options: { tap: (event: Event<any>) => void; filter?: (event: Event<any>) => boolean }) => void;
  publishEvent: (event: Event<any>) => void;
}

export interface Event<T extends {} = {}> {
  name?: string;
  origin?: string;
  payload?: T;
}

export const useEventing = (
  events: Observable<Event<any>>,
  publish: (event: Event<any>, payload?: any) => void
): Eventing => {
  const subscription = useMemo(() => new Subscription(), [events, publish]);

  const subscribeToEvents = useCallback(
    (options: { tap: (event: Event<any>) => void; filter?: (event: Event<any>) => boolean }) => {
      const innerSubscription = events
        .pipe(
          filter((event: Event<any>) => {
            return options.filter ? options.filter(event) : true;
          })
        )
        .subscribe((value: Event<any>) => {
          options.tap(value);
        });

      subscription.add(innerSubscription);
    },
    [events, publish]
  );

  const publishEvent = useCallback((event: Event<any>): void => publish(event), [events, publish]);

  useEffect(() => {
    return function unsubscribe() {
      subscription.unsubscribe();
    };
  }, []);

  return {
    subscribeToEvents,
    publishEvent,
  };
};
