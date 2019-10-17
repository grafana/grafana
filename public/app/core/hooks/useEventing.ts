import { useCallback, useEffect, useMemo } from 'react';
import { Observable, Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';
import { AppEvent, eventFactory } from '@grafana/data';

export interface SubscribeToEventsOptions {
  tap: (event: AppEvent<any>) => void;
  filter?: (event: AppEvent<any>) => boolean;
}

export interface PublishEventOptions<T> {
  event: AppEvent<T>;
  origin: string;
  payload: T;
}

export interface EventingProps {
  events: Observable<AppEvent<any>>;
  publish: (event: AppEvent<any>) => void;
}

export interface Eventing {
  subscribeToEvents: (options: SubscribeToEventsOptions) => void;
  publishEvent: <T>(options: PublishEventOptions<T>) => void;
}

export interface MouseMove {
  clientX: number;
  clientY: number;
  screenX: number;
  screenY: number;
}

export const mouseMoveEvent = eventFactory<MouseMove>('mouse-move-event');

export const useEventing = (props: EventingProps): Eventing => {
  const subscription = useMemo(() => new Subscription(), [props]);

  const subscribeToEvents = useCallback(
    (options: SubscribeToEventsOptions) => {
      const innerSubscription = props.events
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
    [props]
  );

  const publishEvent = useCallback(
    <T>(options: PublishEventOptions<T>): void =>
      props.publish({ ...options.event, origin: options.origin, payload: options.payload }),
    [props]
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
