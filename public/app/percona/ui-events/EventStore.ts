import { DashboardUsageEvent } from 'app/percona/ui-events/events/dashboard';
import { FetchingEvent } from 'app/percona/ui-events/events/fetching';
import { NotificationErrorEvent } from 'app/percona/ui-events/events/notification';
import { UserFlowEvent } from 'app/percona/ui-events/events/userFlow';

class _EventStore {
  dashboardUsage: DashboardUsageEvent[] = [];
  fetching: FetchingEvent[] = [];
  notificationErrors: NotificationErrorEvent[] = [];
  userFlowEvents: UserFlowEvent[] = [];

  isNotEmpty(): boolean {
    return !this.isEmpty();
  }

  isEmpty(): boolean {
    return (
      this.dashboardUsage.length === 0 &&
      this.fetching.length === 0 &&
      this.notificationErrors.length === 0 &&
      this.userFlowEvents.length === 0
    );
  }

  clear(): void {
    this.dashboardUsage = [];
    this.fetching = [];
    this.notificationErrors = [];
    this.userFlowEvents = [];
  }
}

export const EventStore = new _EventStore();
