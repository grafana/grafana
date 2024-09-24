import React, { FC, useEffect, useState } from 'react';

import { Modal, useStyles2 } from '@grafana/ui';
import {
  checkUpdatesChangelogs,
  getSnoozeCurrentVersion,
  setSnoozeCurrentUpdate,
  UpdatesChangelogs,
} from 'app/percona/shared/core/reducers/updates';
import { getUpdatesInfo } from 'app/percona/shared/core/selectors';
import { useAppDispatch } from 'app/store/store';
import { useSelector } from 'app/types';

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
  const dismissModal = async () => {
    if (latest && latest.version) {
      const payload = {
        productTourCompleted: true, // ?
        alertingTourCompleted: true, // ?
        snoozedPmmVersion: latest.version,
      };
      await dispatch(setSnoozeCurrentUpdate(payload));
    }
  };

  return (
    <>
      {showUpdate &&
        changeLogs &&
        (changeLogs?.updates.length > 1 ? (
          <Modal title={Messages.titleOneUpdate}>
            <h3 className={styles.version}>{changeLogs.updates[0].version}</h3>
            <div className={styles.releaseNotesText}>{changeLogs.updates[0].releaseNotesText}</div>
            <div className={styles.howToUpdateTitle}>{Messages.howToUpdate}</div>
            <h3 className={styles.howToUpdateDescription}>{Messages.howToUpdateDescription}</h3>
            <div>
              <button onClick={dismissModal}>Snooze</button>
              <button>Go to updates page</button>
            </div>
          </Modal>
        ) : (
          <Modal title={Messages.titleMultipleUpdates}>
            <div className={styles.newVersionsTitle}>{Messages.newVersions}</div>
            <ul>
              {changeLogs?.updates.map((update: UpdatesChangelogs) => (
                <li key={update.toString()}>{update.version}</li>
              ))}
            </ul>
            <div>
              <button onClick={dismissModal}>Snooze</button>
              <button>Go to updates page</button>
            </div>
          </Modal>
        ))}
    </>
  );
};

export default PerconaUpdateVersion;
