import React from 'react';
import { Page } from 'app/core/components/Page/Page';
import { StoredNotifications } from './StoredNotifications';
export const NotificationsPage = () => {
    return (React.createElement(Page, { navId: "profile/notifications" },
        React.createElement(Page.Contents, null,
            React.createElement(StoredNotifications, null))));
};
export default NotificationsPage;
//# sourceMappingURL=NotificationsPage.js.map