/* eslint-disable react/display-name */
import React, { FC, useMemo, useState, useEffect } from 'react';

import { Button, useStyles } from '@grafana/ui';

import { Table } from '../Table/Table';

import { AddNotificationChannelModal } from './AddNotificationChannelModal';
import { DeleteNotificationChannelModal } from './DeleteNotificationChannelModal/DeleteNotificationChannelModal';
import { Messages } from './NotificationChannel.messages';
import { NotificationChannelProvider } from './NotificationChannel.provider';
import { NotificationChannelService } from './NotificationChannel.service';
import { getStyles } from './NotificationChannel.styles';
import { NotificationChannel as Channel } from './NotificationChannel.types';
import { NotificationChannelActions } from './NotificationChannelActions/NotificationChannelActions';

const { emptyTable, nameColumn, typeColumn, actionsColumn, typeLabel } = Messages;

export const NotificationChannel: FC = () => {
  const styles = useStyles(getStyles);
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [pendingRequest, setPendingRequest] = useState(false);
  const [data, setData] = useState<Channel[]>([]);
  const [selectedNotificationChannel, setSelectedNotificationChannel] = useState<Channel>();

  const columns = useMemo(
    () => [
      {
        Header: nameColumn,
        accessor: 'summary',
      },
      {
        Header: typeColumn,
        accessor: ({ type }: Channel) => typeLabel[type],
      },
      {
        Header: actionsColumn,
        width: '80px',
        accessor: (notificationChannel: Channel) => (
          <NotificationChannelActions notificationChannel={notificationChannel} />
        ),
      },
    ],
    []
  );

  const getNotificationChannels = async () => {
    setPendingRequest(true);
    try {
      setData(await NotificationChannelService.list());
    } catch (e) {
      logger.error(e);
    } finally {
      setPendingRequest(false);
    }
  };

  useEffect(() => {
    getNotificationChannels();
  }, []);

  return (
    <NotificationChannelProvider.Provider
      value={{ getNotificationChannels, setSelectedNotificationChannel, setAddModalVisible, setDeleteModalVisible }}
    >
      <div className={styles.actionsWrapper}>
        <Button
          size="md"
          icon="plus-square"
          variant="link"
          onClick={() => {
            setSelectedNotificationChannel(null);
            setAddModalVisible(!addModalVisible);
          }}
          data-qa="notification-channel-add-modal-button"
        >
          {Messages.addAction}
        </Button>
      </div>
      <Table data={data} columns={columns} pendingRequest={pendingRequest} emptyMessage={emptyTable} />
      <AddNotificationChannelModal
        isVisible={addModalVisible}
        setVisible={setAddModalVisible}
        notificationChannel={selectedNotificationChannel}
      />
      <DeleteNotificationChannelModal
        isVisible={deleteModalVisible}
        setVisible={setDeleteModalVisible}
        notificationChannel={selectedNotificationChannel}
      />
    </NotificationChannelProvider.Provider>
  );
};

NotificationChannel.displayName = 'NotificationChannel';
