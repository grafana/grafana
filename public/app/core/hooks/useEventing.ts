import { Observable, Subscription } from 'rxjs';
import { AppEvent } from '@grafana/data';
import { useCallback, useEffect, useMemo } from 'react';
import { filter } from 'rxjs/operators';
import { Eventing } from '../utils/EventsProvider';

export const useEventing = (
  events: Observable<AppEvent<any>>,
  publish: (event: AppEvent<any>, payload?: any) => void
): Eventing => {
  const subscription = useMemo(() => new Subscription(), [events, publish]);

  const subscribeToEvents = useCallback(
    (options: { tap: (event: AppEvent<any>) => void; filter?: (event: AppEvent<any>) => boolean }) => {
      const innerSubscription = events
        .pipe(
          filter((event: AppEvent<any>) => {
            return options.filter ? options.filter(event) : true;
          })
        )
        .subscribe((value: AppEvent<any>) => {
          options.tap(value);
        });

      subscription.add(innerSubscription);
    },
    [events, publish]
  );

  const publishEvent = useCallback(
    (event: AppEvent<any>, origin: string, payload?: any): void => {
      publish({ ...event, origin }, payload);
    },
    [events, publish]
  );

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
