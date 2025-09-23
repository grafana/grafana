/* eslint-disable @typescript-eslint/consistent-type-assertions,@typescript-eslint/no-explicit-any */

import { EventStore } from 'app/percona/ui-events/EventStore';
import { Action } from 'app/percona/ui-events/reducer';

interface NotificationPayload {
  component: string;
  icon: string;
  id: string;
  severity: string;
  showing: boolean;
  text: string;
  timestamp: number;
  title: string;
  traceId: string;
}

export interface NotificationErrorEvent {
  title: string;
  text: string;
  location: string;
  location_params: string;
}

export const processNotificationEvents = (state: any = {}, action: Action) => {
  if (!action.type.startsWith('appNotifications/')) {
    return state;
  }

  const payload = action.payload as NotificationPayload;

  const event: NotificationErrorEvent = {
    text: payload.text,
    title: payload.title,
    location: window.location.pathname,
    location_params: window.location.search,
  };
  EventStore.notificationErrors.push(event);

  return state;
};
