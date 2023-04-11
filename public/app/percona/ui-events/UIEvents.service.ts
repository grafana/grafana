/* eslint-disable @typescript-eslint/no-explicit-any,@typescript-eslint/consistent-type-assertions, */

import { logger } from '@percona/platform-core';

import { ApiRequest } from 'app/percona/shared/helpers/api';
import { DashboardUsageEvent } from 'app/percona/ui-events/events/dashboard';
import { FetchingEvent } from 'app/percona/ui-events/events/fetching';
import { NotificationErrorEvent } from 'app/percona/ui-events/events/notification';
import { UserFlowEvent } from 'app/percona/ui-events/events/userFlow';

const api = new ApiRequest({ baseURL: '/v1/ui-events' });

interface UIEventsStoreRequest {
  notifications: NotificationErrorEvent[];
  fetching: FetchingEvent[];
  dashboard_usage: DashboardUsageEvent[];
  user_flow_events: UserFlowEvent[];
}

export const UIEventsService = {
  async store(body: UIEventsStoreRequest): Promise<void> {
    try {
      await api.post('/Store', body, true);
    } catch (e) {
      logger.error(e);
    }
  },
};
