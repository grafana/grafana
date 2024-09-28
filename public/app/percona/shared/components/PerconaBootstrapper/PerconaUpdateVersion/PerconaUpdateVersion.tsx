import React, { FC, useEffect, useState } from 'react';

import { dateTimeFormat } from '@grafana/data';
import { Modal, useStyles2, Button } from '@grafana/ui';
import {
  checkUpdatesChangeLogs,
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
    const differenceInDays = () => {
      if (lastChecked) {
        const lastCheckDate = new Date(lastChecked);
        const currentDate = new Date();
        const differenceInMilliseconds = currentDate.getTime() - lastCheckDate.getTime();
        return Math.trunc(differenceInMilliseconds / (1000 * 60 * 60 * 24));
      } else {
        return 7;
      }
    };

    const prepareModal = async () => {
      if (!snoozeCurrentVersion) {
        await dispatch(getSnoozeCurrentVersion());
      }
      const days = differenceInDays();
      if (
        (installed?.version !== latest?.version &&
          days > 6 &&
          snoozeCurrentVersion?.snoozedPmmVersion !== latest?.version) ||
        !lastChecked
      ) {
        setShowUpdate(true);
        await dispatch(checkUpdatesChangeLogs());
      }
    };

    if (updateAvailable) {
      prepareModal();
    }
  }, [dispatch, updateAvailable, installed, latest, snoozeCurrentVersion, lastChecked]);

  const snoozeUpdate = async () => {
    if (latest && latest.version) {
      const payload = {
        productTourCompleted: snoozeCurrentVersion?.productTourCompleted || true,
        alertingTourCompleted: snoozeCurrentVersion?.alertingTourCompleted || true,
        snoozedPmmVersion: latest.version,
      };
      await dispatch(setSnoozeCurrentUpdate(payload));
    }
    setShowUpdate(false);
  };

  const onDismiss = () => {
    setShowUpdate(false);
  };

  return (
    <>
      <Modal
        onDismiss={onDismiss}
        title={Messages.titleOneUpdate}
        isOpen={showUpdate && changeLogs && changeLogs?.updates?.length === 1}
        className={styles.updateVersionModal}
      >
        <div data-testid="one-update-modal">
          <h5 className={styles.version}>{changeLogs?.updates[0]?.version || ''}</h5>
          <p className={styles.releaseNotesText}>
            <a href={changeLogs?.updates[0]?.releaseNotesUrl || ''}>{Messages.fullReleaseNotes}</a>
          </p>
          <h5 className={styles.howToUpdateTitle}>{Messages.howToUpdate}</h5>
          <p className={styles.howToUpdateDescription}>{Messages.howToUpdateDescription}</p>
          <div className={styles.updateButtons}>
            <Button type="button" variant="secondary" onClick={snoozeUpdate} className={styles.snoozeButton}>
              {Messages.snooze}
            </Button>
            <Button type="button" variant="primary">
              <a href="/pmm-ui/updates">{Messages.goToUpdatesPage}</a>
            </Button>
          </div>
        </div>
      </Modal>
      <Modal
        onDismiss={onDismiss}
        title={Messages.titleMultipleUpdates}
        isOpen={showUpdate && changeLogs && changeLogs?.updates?.length > 1}
        className={styles.updateVersionModal}
      >
        <div data-testid="multiple-updates-modal">
          <h5 className={styles.newVersionsTitle}>{Messages.newVersions}</h5>
          <ul className={styles.listOfReleaseNotes}>
            {changeLogs?.updates.map((update: UpdatesChangelogs) => (
              <li key={update.toString()}>
                <a href={update.releaseNotesUrl}>
                  {update.version}, {dateTimeFormat(update.timestamp, { format: 'MMM DD, YYYY' })}
                </a>
              </li>
            ))}
          </ul>
          <h5 className={styles.notesTitle}>{Messages.notes}</h5>
          <p>{Messages.notesDescription}</p>
          <div className={styles.updateButtons}>
            <Button type="button" variant="secondary" onClick={snoozeUpdate} className={styles.snoozeButton}>
              {Messages.snooze}
            </Button>
            <Button type="button" variant="primary">
              <a href="/pmm-ui/updates">{Messages.goToUpdatesPage}</a>
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
};

export default PerconaUpdateVersion;
