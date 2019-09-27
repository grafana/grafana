import React, { ComponentType, FunctionComponent, useEffect } from 'react';
import { Observable, Subject, Unsubscribable } from 'rxjs';
import { filter } from 'rxjs/operators';
import { AppEvent, Subtract } from '@grafana/data';

import appEvents from '../app_events';

export interface EventsContextApi<SubscribeEvents, PublishEvents> {
  events: (originFilter: string) => Observable<AppEvent<SubscribeEvents>>;
  publish: (event: AppEvent<PublishEvents>, origin: string, payload?: PublishEvents) => void;
}

export interface RootEventsContextApi {
  rootEvents: Observable<AppEvent<any>>;
  rootPublish: (event: AppEvent<any>, payload?: any) => void;
}

const events = new Subject<AppEvent<any>>();
const publish = <T extends {} = {}>(event: AppEvent<T>, payload?: T) => {
  events.next({ ...event, payload });
  appEvents.emit(event, payload);
};

export const rootEventing: RootEventsContextApi = {
  rootEvents: events,
  rootPublish: publish,
};

export const EventsContext = React.createContext(rootEventing);
EventsContext.displayName = 'EventsContext';

export const EventsProvider = ({ children }: { children: React.ReactNode }) => {
  return <EventsContext.Provider value={rootEventing}>{children}</EventsContext.Provider>;
};

export const provideEvents = (component: ComponentType<any>) => (props: any) => (
  <EventsProvider>{React.createElement(component, { ...props })}</EventsProvider>
);

export const withEvents = <SubscribeEvents extends {}, PublishEvents extends {}>(
  ...subscribeEvents: Array<AppEvent<SubscribeEvents>>
) => {
  type ComponentWithEventingType = EventsContextApi<SubscribeEvents, PublishEvents>;
  return <C extends ComponentWithEventingType>(Component: ComponentType<C>) => {
    type ComponentWithOutEventingType = Subtract<C, ComponentWithEventingType>;

    const ComponentWithEventing: FunctionComponent<ComponentWithOutEventingType> = (props: any) => {
      useEffect(() => {
        return function unsubscribe() {
          if (subscription) {
            subscription.unsubscribe();
            subscription = null;
          }
          events.unsubscribe();
        };
      }, []);
      let subscription: Unsubscribable | null = null;
      const events = new Subject<AppEvent<SubscribeEvents>>();
      const subscribe = (origin: string): Observable<AppEvent<SubscribeEvents>> => {
        subscription = props.rootEvents
          .pipe(
            filter((event: AppEvent<any>) => {
              if (event.origin === origin) {
                return false;
              }
              const found = subscribeEvents.filter(value => value.name === event.name)[0];
              return found !== undefined;
            })
          )
          .subscribe((value: AppEvent<SubscribeEvents>) => {
            if (events) {
              events.next(value);
            }
          });

        return events.asObservable();
      };
      const publish = (event: AppEvent<PublishEvents>, origin: string, payload?: PublishEvents): void => {
        props.rootPublish({ ...event, origin }, payload);
      };

      return <Component {...props} events={subscribe} publish={publish} />;
    };

    ComponentWithEventing.displayName = `ComponentWithEventing(${Component.displayName})`;

    const EventsConsumer: FunctionComponent<ComponentWithOutEventingType> = props => {
      return (
        <EventsContext.Consumer>
          {(eventing: RootEventsContextApi) => {
            return <ComponentWithEventing {...props} rootEvents={eventing.rootEvents} rootPublish={eventing.rootPublish} />;
          }}
        </EventsContext.Consumer>
      );
    };

    EventsConsumer.displayName = 'EventsConsumer';

    return EventsConsumer;
  };
};
