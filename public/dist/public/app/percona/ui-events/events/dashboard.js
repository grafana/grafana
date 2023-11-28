/* eslint-disable @typescript-eslint/no-explicit-any,@typescript-eslint/consistent-type-assertions, */
import { EventStore } from 'app/percona/ui-events/EventStore';
const startLoadingEvent = 'dashboard/dashboardInitFetching';
const endLoadingEvent = 'dashboard/dashboardInitCompleted';
const supportedEvents = [startLoadingEvent, endLoadingEvent];
let loadingStarted = null;
export const processDashboardEvents = (state = {}, action) => {
    if (!supportedEvents.find((each) => action.type.startsWith(each))) {
        return state;
    }
    if (action.type === startLoadingEvent) {
        loadingStarted = Date.now();
    }
    else if (action.type === endLoadingEvent) {
        let payload = action.payload;
        if (loadingStarted != null) {
            if (payload.uid !== null) {
                const now = Date.now();
                const event = {
                    uid: payload.uid,
                    title: payload.title,
                    tags: payload.tags,
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
//# sourceMappingURL=dashboard.js.map