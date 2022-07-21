import React from 'react';

import { Page } from 'app/core/components/Page/Page';

import { StoredNotifications } from './StoredNotifications';

export const NotificationsPage = () => {
  return (
    <Page navId="profile/notifications">
      <Page.Contents>
        <StoredNotifications />
      </Page.Contents>
    </Page>
  );
};

export default NotificationsPage;
