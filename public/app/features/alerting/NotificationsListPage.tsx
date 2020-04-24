import React, { useState, FC, useEffect } from 'react';
import EmptyListCTA from 'app/core/components/EmptyListCTA/EmptyListCTA';
import Page from 'app/core/components/Page/Page';
import { getBackendSrv } from '@grafana/runtime';
import { useAsyncFn } from 'react-use';
import { useNavModel } from 'app/core/hooks/useNavModel';
import { HorizontalGroup, Button, LinkButton } from '@grafana/ui';
import { AlertNotification } from 'app/types/alerting';

const deleteNotification = async (id: number) => {
  return await getBackendSrv().delete(`/api/alert-notifications/${id}`);
};

const getNotifications = async () => {
  return await getBackendSrv().get(`/api/alert-notifications`);
};

const NotificationsListPage: FC = () => {
  const navModel = useNavModel('channels');

  const [notifications, setNotifications] = useState<AlertNotification[]>();
  const [state, fetchNotifications] = useAsyncFn(getNotifications);
  useEffect(() => {
    fetchNotifications().then(res => {
      setNotifications(res);
    });
  }, []);

  return (
    <Page navModel={navModel}>
      <Page.Contents>
        {state.error && <p>{state.error}</p>}
        {!!notifications?.length && (
          <>
            <div className="page-action-bar">
              <div className="page-action-bar__spacer" />
              <LinkButton icon="channel-add" href="alerting/notification/new">
                New channel
              </LinkButton>
            </div>
            <table className="filter-table filter-table--hover">
              <thead>
                <tr>
                  <th style={{ minWidth: '200px' }}>
                    <strong>Name</strong>
                  </th>
                  <th style={{ minWidth: '100px' }}>Type</th>
                  <th style={{ width: '1%' }}></th>
                </tr>
              </thead>
              <tbody>
                {notifications.map(notification => (
                  <tr key={notification.id}>
                    <td className="link-td">
                      <a href={`alerting/notification/${notification.id}/edit`}>{notification.name}</a>
                    </td>
                    <td className="link-td">
                      <a href={`alerting/notification/${notification.id}/edit`}>{notification.type}</a>
                    </td>
                    <td className="text-right">
                      <HorizontalGroup justify="flex-end">
                        {notification.isDefault && (
                          <Button disabled variant="secondary" size="sm">
                            default
                          </Button>
                        )}
                        <Button
                          variant="destructive"
                          icon="times"
                          size="sm"
                          onClick={() => {
                            deleteNotification(notification.id);
                            setNotifications(notifications.filter(notify => notify.id !== notification.id));
                            fetchNotifications();
                          }}
                        />
                      </HorizontalGroup>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        {!(notifications?.length || state.loading) && (
          <EmptyListCTA
            title="There are no notification channels defined yet"
            buttonIcon="channel-add"
            buttonLink="alerting/notification/new"
            buttonTitle="Add channel"
            proTip="You can include images in your alert notifications."
            proTipLink="http://docs.grafana.org/alerting/notifications/"
            proTipLinkTitle="Learn more"
            proTipTarget="_blank"
          />
        )}
      </Page.Contents>
    </Page>
  );
};

export default NotificationsListPage;
