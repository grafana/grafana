import React, { FC, useEffect, useState } from 'react';
import { useSelector } from 'app/types';
import { getUpdatesInfo } from 'app/percona/shared/core/selectors';
import { Modal } from '@grafana/ui';
import { Messages } from './PerconaUpdateVersion.constants';

const PerconaUpdateVersion: FC = () => {
  const { updateAvailable, last_check, installed: { version: installedVersion }, latest: { version: latestVersion } } = useSelector(getUpdatesInfo);
  const [showUpdate, setShowUpdate] = useState(false);

  useEffect(() => {
    if(updateAvailable) {
      const lastCheckDate = new Date(lastCheck);
      const currentDate = new Date();
      const differenceInMilliseconds = currentDate - lastCheckDate;
      const differenceInDays = differenceInMilliseconds / (1000 * 60 * 60 * 24);

      if (installedVersion !== latestVersion && differenceInDays > 6) {
        setShowUpdate(true);
      }
    }
  }, [updateAvailable]);

  const dismissModal = () => {
    // Snooze API
  };

  return (
    <>
      {showUpdate && (
        <Modal title={Messages.titleOneUpdate}>

        </Modal>
      )}
    </>
  )

}
