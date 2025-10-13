/* eslint-disable @typescript-eslint/no-explicit-any,@typescript-eslint/consistent-type-assertions, */

import { EventStore } from 'app/percona/ui-events/EventStore';
import { Action } from 'app/percona/ui-events/reducer';

interface FetchingPayload {
  action: {
    payload: {
      id: string;
      type: string;
      data: any;
    };
    type: string;
  };
  key: string;
}

export interface FetchingEvent {
  component: string;
  load_time: number;
  location: string;
  location_params: string;
}

const startFetchingEvent = 'templating/keyed/shared/variableStateFetching';
const endFetchingEvent = 'templating/keyed/shared/variableStateCompleted';

const supportedEvents = [startFetchingEvent, endFetchingEvent];

const fetchingEvents = new Map();

export const processFetchingEvents = (state: any = {}, action: Action): any => {
  if (!supportedEvents.find((each) => action.type.startsWith(each))) {
    return state;
  }

  const payload = action.payload as FetchingPayload;
  const component = `${payload.key}-${payload.action.payload.id}`;

  if (action.type === startFetchingEvent) {
    fetchingEvents.set(component, Date.now());
  } else if (action.type === endFetchingEvent) {
    const start = fetchingEvents.get(component);
    const now = Date.now();
    if (start !== undefined) {
      fetchingEvents.delete(component);
      const event: FetchingEvent = {
        component,
        load_time: now - start,
        location: window.location.pathname,
        location_params: window.location.search,
      };
      EventStore.fetching.push(event);
    }
  }

  return state;
};
