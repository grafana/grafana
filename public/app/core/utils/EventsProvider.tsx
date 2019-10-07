import React, { ComponentType, FunctionComponent } from 'react';
import { Observable, Subject } from 'rxjs';

import appEvents from '../app_events';
import { Event, Eventing, useEventing } from '../hooks/useEventing';

export interface EventsContextType {
  events: Observable<Event<any>>;
  publish: (event: Event<any>, payload?: any) => void;
  cleanUp: () => void;
}

const events = new Subject<Event<any>>();

export const cleanUpEventing = () => {
  events.unsubscribe();
};

const eventing: EventsContextType = {
  events,
  publish: <T extends {} = {}>(event: Event<T>) => {
    events.next(event);
    appEvents.emit(event.name, event.payload);
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

interface EventsControllerProps {
  events: Observable<Event<any>>;
  publish: (event: Event<any>, payload?: any) => void;
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
