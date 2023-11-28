/* eslint-disable @typescript-eslint/no-explicit-any,@typescript-eslint/consistent-type-assertions, */
import { EventStore } from 'app/percona/ui-events/EventStore';
const startFetchingEvent = 'templating/keyed/shared/variableStateFetching';
const endFetchingEvent = 'templating/keyed/shared/variableStateCompleted';
const supportedEvents = [startFetchingEvent, endFetchingEvent];
const fetchingEvents = new Map();
export const processFetchingEvents = (state = {}, action) => {
    if (!supportedEvents.find((each) => action.type.startsWith(each))) {
        return state;
    }
    const payload = action.payload;
    const component = `${payload.key}-${payload.action.payload.id}`;
    if (action.type === startFetchingEvent) {
        fetchingEvents.set(component, Date.now());
    }
    else if (action.type === endFetchingEvent) {
        const start = fetchingEvents.get(component);
        const now = Date.now();
        if (start !== undefined) {
            fetchingEvents.delete(component);
            const event = {
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
//# sourceMappingURL=fetching.js.map