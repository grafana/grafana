import React, { FC, useContext } from 'react';

import { IconButton, Tooltip, useStyles } from '@grafana/ui';

import { NotificationChannelProvider } from '../NotificationChannel.provider';

import { getStyles } from './NotificationChannelActions.styles';
import { NotificationChannelActionsProps } from './NotificationChannelActions.types';

export const NotificationChannelActions: FC<NotificationChannelActionsProps> = ({ notificationChannel }) => {
  const styles = useStyles(getStyles);
  const { setSelectedNotificationChannel, setAddModalVisible, setDeleteModalVisible } =
    useContext(NotificationChannelProvider);

  return (
    <div className={styles.actionsWrapper}>
      <Tooltip placement="top" content="Edit">
        <IconButton
          data-testid="edit-notification-channel-button"
          name="pen"
          onClick={() => {
            setSelectedNotificationChannel(notificationChannel);
            setAddModalVisible(true);
          }}
        />
      </Tooltip>
      <Tooltip placement="top" content="Delete">
        <IconButton
          data-testid="delete-notification-channel-button"
          name="times"
          size="xl"
          onClick={() => {
            setSelectedNotificationChannel(notificationChannel);
            setDeleteModalVisible(true);
          }}
        />
      </Tooltip>
    </div>
  );
};
NotificationChannelActions.displayName = 'NotificationChannelActions';
