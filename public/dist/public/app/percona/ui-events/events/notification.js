/* eslint-disable @typescript-eslint/consistent-type-assertions,@typescript-eslint/no-explicit-any */
import { EventStore } from 'app/percona/ui-events/EventStore';
export const processNotificationEvents = (state = {}, action) => {
    if (!action.type.startsWith('appNotifications/')) {
        return state;
    }
    const payload = action.payload;
    const event = {
        text: payload.text,
        title: payload.title,
        location: window.location.pathname,
        location_params: window.location.search,
    };
    EventStore.notificationErrors.push(event);
    return state;
};
//# sourceMappingURL=notification.js.map