import React, { useState, FC, useEffect } from 'react';
import { useAsyncFn } from 'react-use';

import { getBackendSrv } from '@grafana/runtime';
import { HorizontalGroup, Button, LinkButton } from '@grafana/ui';
import EmptyListCTA from 'app/core/components/EmptyListCTA/EmptyListCTA';
import { Page } from 'app/core/components/Page/Page';
import { appEvents } from 'app/core/core';
import { useNavModel } from 'app/core/hooks/useNavModel';
import { AlertNotification } from 'app/types/alerting';

import { ShowConfirmModalEvent } from '../../types/events';

const NotificationsListPage: FC = () => {
  const navModel = useNavModel('channels');

  const [notifications, setNotifications] = useState<AlertNotification[]>([]);

  const getNotifications = async () => {
    return await getBackendSrv().get(`/api/alert-notifications`);
  };

  const [state, fetchNotifications] = useAsyncFn(getNotifications);
  useEffect(() => {
    fetchNotifications().then((res) => {
      setNotifications(res);
    });
  }, [fetchNotifications]);

  const deleteNotification = (id: number) => {
    appEvents.publish(
      new ShowConfirmModalEvent({
        title: 'Delete',
        text: 'Do you want to delete this notification channel?',
        text2: `Deleting this notification channel will not delete from alerts any references to it`,
        icon: 'trash-alt',
        confirmText: 'Delete',
        yesText: 'Delete',
        onConfirm: async () => {
          deleteNotificationConfirmed(id);
        },
      })
    );
  };

  const deleteNotificationConfirmed = async (id: number) => {
    await getBackendSrv().delete(`/api/alert-notifications/${id}`);
    const notifications = await fetchNotifications();
    setNotifications(notifications);
  };

  return (
    <Page navModel={navModel}>
      <Page.Contents>
        {state.error && <p>{state.error}</p>}
        {!!notifications.length && (
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
                {notifications.map((notification) => (
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

        {!(notifications.length || state.loading) && (
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
