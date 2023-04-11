/* eslint-disable @typescript-eslint/no-explicit-any,@typescript-eslint/consistent-type-assertions, */

import { DashboardModel } from 'app/features/dashboard/state';
import { EventStore } from 'app/percona/ui-events/EventStore';
import { Action } from 'app/percona/ui-events/reducer';

export interface DashboardUsageEvent {
  uid: string;
  title: string;
  tags: string[];
  loadTime: number;
  location: string;
  location_params: string;
}

const startLoadingEvent = 'dashboard/dashboardInitFetching';
const endLoadingEvent = 'dashboard/dashboardInitCompleted';

const supportedEvents = [startLoadingEvent, endLoadingEvent];

let loadingStarted: null | number = null;

export const processDashboardEvents = (state: any = {}, action: Action): any => {
  if (!supportedEvents.find((each) => action.type.startsWith(each))) {
    return state;
  }

  if (action.type === startLoadingEvent) {
    loadingStarted = Date.now();
  } else if (action.type === endLoadingEvent) {
    let payload = action.payload as DashboardModel;
    if (loadingStarted != null) {
      if (payload.uid !== null) {
        const now = Date.now();
        const event: DashboardUsageEvent = {
          uid: payload.uid,
          title: payload.title,
          tags: payload.tags as string[],
          loadTime: now - loadingStarted,
          location: window.location.pathname,
          location_params: window.location.search,
        };
        EventStore.dashboardUsage.push(event);
      }
      loadingStarted = null;
    }
  }

  return state;
};
