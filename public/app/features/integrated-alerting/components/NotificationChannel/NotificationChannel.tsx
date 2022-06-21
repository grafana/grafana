import { logger } from '@percona/platform-core';
import React, { FC, useMemo, useState, useEffect } from 'react';

import { Button, useStyles } from '@grafana/ui';

import { Table } from '../Table/Table';

import { AddNotificationChannelModal } from './AddNotificationChannelModal';
import { Messages } from './NotificationChannel.messages';
import { NotificationChannelProvider } from './NotificationChannel.provider';
import { NotificationChannelService } from './NotificationChannel.service';
import { getStyles } from './NotificationChannel.styles';
import { NotificationChannel as Channel } from './NotificationChannel.types';

const { emptyTable, nameColumn, typeColumn, typeLabel } = Messages;

export const NotificationChannel: FC = () => {
  const styles = useStyles(getStyles);
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [pendingRequest, setPendingRequest] = useState(false);
  const [data, setData] = useState<Channel[]>([]);

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
    <NotificationChannelProvider.Provider value={{ getNotificationChannels }}>
      <div className={styles.actionsWrapper}>
        <Button
          size="md"
          icon="plus-square"
          variant="link"
          onClick={() => setAddModalVisible(!addModalVisible)}
          data-qa="notification-channel-add-modal-button"
        >
          {Messages.addAction}
        </Button>
      </div>
      <Table data={data} columns={columns} pendingRequest={pendingRequest} emptyMessage={emptyTable} />
      <AddNotificationChannelModal isVisible={addModalVisible} setVisible={setAddModalVisible} />
    </NotificationChannelProvider.Provider>
  );
};
