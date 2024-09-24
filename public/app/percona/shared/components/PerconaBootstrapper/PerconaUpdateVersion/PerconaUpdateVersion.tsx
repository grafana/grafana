import React, { FC, useEffect, useState } from 'react';

import { Modal, useStyles2, Button } from '@grafana/ui';
import {
  checkUpdatesChangelogs,
  getSnoozeCurrentVersion,
  setSnoozeCurrentUpdate,
  UpdatesChangelogs,
} from 'app/percona/shared/core/reducers/updates';
import { getUpdatesInfo } from 'app/percona/shared/core/selectors';
import { useAppDispatch } from 'app/store/store';
import { useSelector } from 'app/types';
import { dateTimeFormat } from '@grafana/data';

import { Messages } from './PerconaUpdateVersion.constants';
import { getStyles } from './PerconaUpdateVersion.styles';

const PerconaUpdateVersion: FC = () => {
  const { updateAvailable, installed, latest, changeLogs, lastChecked, snoozeCurrentVersion } =
    useSelector(getUpdatesInfo);

  const [showUpdate, setShowUpdate] = useState(false);
  const dispatch = useAppDispatch();
  const styles = useStyles2(getStyles);

  useEffect(() => {
    const showModal = async () => {
      console.log('checkUpdatesChangelogs');
      await dispatch(checkUpdatesChangelogs());
      setShowUpdate(true);
    };

    const differenceInDays = async () => {
      if (lastChecked) {
        const lastCheckDate = new Date(lastChecked);
        const currentDate = new Date();
        const differenceInMilliseconds = currentDate.getTime() - lastCheckDate.getTime();
        return Math.trunc(differenceInMilliseconds / (1000 * 60 * 60 * 24));
      } else {
        return 7;
      }
    };

    if (updateAvailable) {
      if (!snoozeCurrentVersion) {
        dispatch(getSnoozeCurrentVersion());
      }
      differenceInDays().then((days) => {
        if (
          (installed?.version !== latest?.version /*days > 6 &&*/ &&
            snoozeCurrentVersion?.snoozedPmmVersion !== latest?.version) ||
          !lastChecked
        ) {
          showModal();
        }
      });
    }
  }, [dispatch, updateAvailable, installed, latest, snoozeCurrentVersion, lastChecked]);

  // Snooze API
  const snoozeUpdate = async () => {
    if (latest && latest.version) {
      const payload = {
        productTourCompleted: true, // ?
        alertingTourCompleted: true, // ?
        snoozedPmmVersion: latest.version,
      };
      await dispatch(setSnoozeCurrentUpdate(payload));
    }
  };

  const onDismiss = () => {
    setShowUpdate(false);
  }

  return (
    <>
          <Modal onDismiss={onDismiss} title={Messages.titleOneUpdate} isOpen={showUpdate && changeLogs && changeLogs?.updates.length === 1 }>
            <h5 className={styles.version}>{changeLogs?.updates[0].version}</h5>
            <p className={styles.releaseNotesText}>{changeLogs?.updates[0].releaseNotesText}</p>
            <h5 className={styles.howToUpdateTitle}>{Messages.howToUpdate}</h5>
            <p className={styles.howToUpdateDescription}>{Messages.howToUpdateDescription}</p>
            <div>
              <Button type="button" variant="secondary" onClick={snoozeUpdate}>Snooze</Button>
              <Button type="button" variant="primary">Go to updates page</Button>
            </div>
          </Modal>
          <Modal onDismiss={onDismiss} title={Messages.titleMultipleUpdates} isOpen={showUpdate && changeLogs && changeLogs?.updates.length > 1}>
            <h5 className={styles.newVersionsTitle}>{Messages.newVersions}</h5>
            <ul>
              {changeLogs?.updates.map((update: UpdatesChangelogs) => (
                <li key={update.toString()}>{update.version}, {dateTimeFormat(update.timestamp)}</li>
              ))}
            </ul>
            <div>
              <Button type="button" variant="secondary" onClick={snoozeUpdate}>Snooze</Button>
              <Button type="button" variant="primary">Go to updates page</Button>
            </div>
          </Modal>
    </>
  );
};

export default PerconaUpdateVersion;
