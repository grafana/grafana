import React, { FC, useEffect, useState } from 'react';

import { Modal, useStyles2 } from '@grafana/ui';
import { checkUpdatesChangelogs, getSnoozeCurrentVersion } from 'app/percona/shared/core/reducers/updates';
import { getChangeLogs, getUserSnoozeVersion, getUpdatesInfo } from 'app/percona/shared/core/selectors';
import { useAppDispatch } from 'app/store/store';
import { useSelector } from 'app/types';

import { Messages } from './PerconaUpdateVersion.constants';
import { getStyles } from './PerconaUpdateVersion.styles';

const PerconaUpdateVersion: FC = () => {
  const {
    updateAvailable,
    installed: { version: installedVersion },
    latest: { version: latestVersion },
  } = useSelector(getUpdatesInfo);
  const { updates } = useSelector(getChangeLogs);
  const { snoozeCurrentVersion } = useSelector(getUserSnoozeVersion);

  const [showUpdate, setShowUpdate] = useState(false);
  const dispatch = useAppDispatch();
  const styles = useStyles2(getStyles);

  useEffect(() => {
    if (updateAvailable) {
      const lastCheckDate = new Date(lastCheck);
      const currentDate = new Date();
      const differenceInMilliseconds = currentDate - lastCheckDate;
      const differenceInDays = differenceInMilliseconds / (1000 * 60 * 60 * 24);

      if (
        installedVersion !== latestVersion &&
        differenceInDays > 6 &&
        snoozeCurrentVersion.snoozedPmmVersion === latestVersion
      ) {
        setShowUpdate(true);
        await dispatch(checkUpdatesChangelogs());
      }
    }
  }, [dispatch, updateAvailable, installedVersion, latestVersion, snoozeCurrentVersion]);

  useEffect(() => {
    if (!snoozeCurrentVersion) {
      dispatch(getSnoozeCurrentVersion());
    }
  }, [dispatch, snoozeCurrentVersion]);

  // Snooze API
  const dismissModal = () => {
    const payload = {
      productTourCompleted: true, // ?
      alertingTourCompleted: true, // ?
      snoozedPmmVersion: latestVersion,
    };
    dispatch(snoozeCurrentVersion(payload));
  };
  /*
* version: string;
  tag: string;
  timestamp: string;
  releaseNodesUrl: string;
  releaseNotesText: string,*/
  return (
    <>
      {showUpdate &&
        (updates.length > 1 ? (
          <Modal title={Messages.titleOneUpdate}>
            <h3 className={styles.version}>{updates[0].version}</h3>
            <div className={styles.releaseNotesText}>{updates[0].releaseNotesText}</div>
            <div className={styles.howToUpdateTitle}>{Messages.howToUpdate}</div>
            <h3 className={styles.howToUpdateDescription}>{Messages.howToUpdateDescription}</h3>
          </Modal>
        ) : (
          <Modal title={Messages.titleMultipleUpdates}>
            <div className={styles.newVersionsTitle}>{Messages.newVersions}</div>
            <ul>
              {updates.map((update) => (
                <li key={update.toString()}>{update.version}</li>
              ))}
            </ul>
          </Modal>
        ))}
    </>
  );
};
