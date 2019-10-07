import React, { ComponentType, FunctionComponent } from 'react';
import { Observable, Subject } from 'rxjs';
import { AppEvent } from '@grafana/data';

import appEvents from '../app_events';
import { useEventing } from '../hooks/useEventing';

export interface EventsContextType {
  events: Observable<AppEvent<any>>;
  publish: (event: AppEvent<any>, payload?: any) => void;
  cleanUp: () => void;
}

const events = new Subject<AppEvent<any>>();

export const cleanUpEventing = () => {
  events.unsubscribe();
};

const eventing: EventsContextType = {
  events,
  publish: <T extends {} = {}>(event: AppEvent<T>, payload?: T) => {
    events.next({ ...event, payload });
    appEvents.emit(event, payload);
  },
  cleanUp: cleanUpEventing,
};

export const EventsContext = React.createContext(eventing);
EventsContext.displayName = 'EventsContext';

const EventsProvider = ({ children }: { children: React.ReactNode }) => {
  return <EventsContext.Provider value={eventing}>{children}</EventsContext.Provider>;
};

export const provideEvents = (component: ComponentType<any>) => (props: any) => (
  <EventsProvider>{React.createElement(component, { ...props })}</EventsProvider>
);

export interface Eventing {
  subscribeToEvents: (options: {
    tap: (event: AppEvent<any>) => void;
    filter?: (event: AppEvent<any>) => boolean;
  }) => void;
  publishEvent: (event: AppEvent<any>, origin: string, payload?: any) => void;
}

interface EventsControllerProps {
  events: Observable<AppEvent<any>>;
  publish: (event: AppEvent<any>, payload?: any) => void;
  children: (eventing: Eventing) => React.ReactElement;
}

export interface EventsControllerApi {
  children: (eventing: Eventing) => React.ReactElement;
}

const EventsController: FunctionComponent<EventsControllerProps> = React.memo(props => {
  const eventing = useEventing(props.events, props.publish);
  return props.children(eventing);
});

EventsController.displayName = 'EventsController';

export const EventsConsumer: FunctionComponent<EventsControllerApi> = React.memo(props => {
  return (
    <EventsContext.Consumer>
      {(eventing: EventsContextType) => {
        return <EventsController events={eventing.events} publish={eventing.publish} {...props} />;
      }}
    </EventsContext.Consumer>
  );
});

EventsConsumer.displayName = 'EventsConsumer';
