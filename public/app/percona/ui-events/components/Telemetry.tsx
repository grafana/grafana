import React, { FC, useEffect } from 'react';
import { useSelector } from 'react-redux';

import { getPerconaSettings } from 'app/percona/shared/core/selectors';
import { EventStore } from 'app/percona/ui-events/EventStore';
import { UIEventsService } from 'app/percona/ui-events/UIEvents.service';

export interface UiEventsProps {}

const _Telemetry: FC<UiEventsProps> = ({}) => {
  const { result } = useSelector(getPerconaSettings);

  const telemetryEnabled = !!result?.telemetryEnabled;

  // cleanup
  useEffect(() => {
    return () => {
      if (telemetryEnabled) {
        EventStore.clear();
      }
    };
  }, [telemetryEnabled]);

  useEffect(() => {
    if (telemetryEnabled) {
      console.log('Telemetry is enabled');
      const interval = setInterval(() => {
        if (telemetryEnabled) {
          if (EventStore.isNotEmpty()) {
            UIEventsService.store({
              notifications: EventStore.notificationErrors,
              fetching: EventStore.fetching,
              dashboard_usage: EventStore.dashboardUsage,
              user_flow_events: EventStore.userFlowEvents,
            })
              .then(() => {
                EventStore.clear();
              })
              .catch((e) => console.error(e));
          } else {
            console.log('No UI events to send');
          }
        }
      }, 10_000); //TODO: extract to settings

      return () => clearInterval(interval);
    } else {
      console.info('Telemetry is disabled');
      return () => {};
    }
  }, [telemetryEnabled]);

  return null;
};

export const Telemetry = React.memo(_Telemetry);
