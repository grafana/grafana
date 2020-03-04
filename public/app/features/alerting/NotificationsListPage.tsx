import React, { useState, FC } from 'react';
import EmptyListCTA from 'app/core/components/EmptyListCTA/EmptyListCTA';
import Page from 'app/core/components/Page/Page';
import { getBackendSrv } from '@grafana/runtime';
import { StoreState } from 'app/types';
import { connect } from 'react-redux';
import { hot } from 'react-hot-loader';
import { useAsync } from 'react-use';
import { NavModelItem } from '@grafana/data';

interface PropsWithState {
  navModel: NavModelItem;
}

export const NotificationsListPage: FC<PropsWithState> = ({ navModel }) => {
  const [notifications, setNotifications] = useState();
  useAsync(async () => {
    await getBackendSrv()
      .get(`/api/alert-notifications`)
      .then((result: any) => {
        setNotifications(result);
      });
  });

  console.log(notifications);
  // const navModel = new NavModelSrv().getNav('alerting', 'channels', 0);
  return (
    <Page navModel={{ main: navModel.parentItem, node: navModel }}>
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

const mapStateToProps = (state: StoreState) => ({
  navModel: state.navIndex['channels'],
});

export default hot(module)(connect(mapStateToProps)(NotificationsListPage));
