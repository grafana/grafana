import { logger } from '@percona/platform-core';
import React, { FC, useContext, useState } from 'react';

import { AppEvents } from '@grafana/data';
import { appEvents } from 'app/core/core';

import { DeleteModal } from '../../DeleteModal';
import { NotificationChannelProvider } from '../NotificationChannel.provider';
import { NotificationChannelService } from '../NotificationChannel.service';

import { DeleteNotificationChannelModalProps } from './DeleteNotificationChannelModal.types';
import { Messages } from './DeleteNotificationChannelsModal.messages';

const { title, getDeleteMessage, getDeleteSuccess } = Messages;

export const DeleteNotificationChannelModal: FC<DeleteNotificationChannelModalProps> = ({
  isVisible,
  notificationChannel,
  setVisible,
}) => {
  const [pending, setPending] = useState(false);
  const { summary } = notificationChannel || {};
  const { getNotificationChannels } = useContext(NotificationChannelProvider);
  const onDelete = async () => {
    try {
      setPending(true);
      await NotificationChannelService.remove(notificationChannel);
      setVisible(false);
      appEvents.emit(AppEvents.alertSuccess, [getDeleteSuccess(summary)]);
      getNotificationChannels();
    } catch (e) {
      logger.error(e);
    } finally {
      setPending(false);
    }
  };

  return (
    <DeleteModal
      title={title}
      message={getDeleteMessage(summary)}
      loading={pending}
      isVisible={isVisible}
      setVisible={setVisible}
      onDelete={onDelete}
    />
  );
};
