import React, { ComponentType, FunctionComponent, useMemo } from 'react';
import { Subject } from 'rxjs';
import { AppEvent } from '@grafana/data';

import appEvents from '../app_events';
import { Eventing, EventingProps, useEventing } from '../hooks/useEventing';

export interface EventsContextType extends EventingProps {
  cleanUp: () => void;
}

const events = new Subject<AppEvent<any>>();

export const cleanUpEventing = () => {
  events.unsubscribe();
  appEvents.removeAllListeners();
};

const eventing: EventsContextType = {
  events,
  publish: (event: AppEvent<any>) => {
    events.next(event);
    appEvents.emit<any>(event, event.payload);
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

interface EventsControllerProps extends EventingProps {
  children: (eventing: Eventing) => React.ReactElement;
}

export interface EventsControllerApi {
  children: (eventing: Eventing) => React.ReactElement;
}

const EventsController: FunctionComponent<EventsControllerProps> = React.memo(props => {
  const eventingProps = useMemo(
    () => ({
      events: props.events,
      publish: props.publish,
    }),
    [props.events, props.publish]
  );
  const eventing = useEventing(eventingProps);
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
