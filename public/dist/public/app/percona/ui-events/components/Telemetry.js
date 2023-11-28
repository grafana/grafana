import React, { useEffect } from 'react';
import { getPerconaSettings } from 'app/percona/shared/core/selectors';
import { EventStore } from 'app/percona/ui-events/EventStore';
import { UIEventsService } from 'app/percona/ui-events/UIEvents.service';
import { useSelector } from 'app/types';
const _Telemetry = ({}) => {
    const { result } = useSelector(getPerconaSettings);
    const telemetryEnabled = !!(result === null || result === void 0 ? void 0 : result.telemetryEnabled);
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
                            .catch((e) => {
                            console.error(e);
                        });
                    }
                    else {
                        console.log('No UI events to send');
                    }
                }
            }, 10000); //TODO: extract to settings
            return () => clearInterval(interval);
        }
        else {
            console.info('Telemetry is disabled');
            return () => { };
        }
    }, [telemetryEnabled]);
    return null;
};
export const Telemetry = React.memo(_Telemetry);
//# sourceMappingURL=Telemetry.js.map