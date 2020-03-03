import React, { useState } from 'react';
import EmptyListCTA from 'app/core/components/EmptyListCTA/EmptyListCTA';
import Page from 'app/core/components/Page/Page';
import { NavModelSrv } from 'app/core/core';
import { getBackendSrv } from '@grafana/runtime';

export const NotificationsListPage = () => {
  const [notifications, setNotifications] = useState();

  getBackendSrv()
    .get(`/api/alert-notifications`)
    .then((result: any) => {
      setNotifications(result);
    });
  console.log(notifications);
  const navModel = new NavModelSrv().getNav('alerting', 'channels', 0);
  return (
    <Page navModel={navModel}>
      <Page.Contents>
        {notifications && notifications.map()}

        {!notifications && (
          <EmptyListCTA
            title="'There are no notification channels defined yet'"
            buttonIcon="'gicon gicon-alert-notification-channel'"
            buttonLink="'alerting/notification/new'"
            buttonTitle="'Add channel'"
            proTip="'You can include images in your alert notifications.'"
            proTipLink="'http://docs.grafana.org/alerting/notifications/'"
            proTipLinkTitle="'Learn more'"
            proTipTarget="'_blank'"
          />
        )}
      </Page.Contents>
    </Page>
  );
};

export default NotificationsListPage;
