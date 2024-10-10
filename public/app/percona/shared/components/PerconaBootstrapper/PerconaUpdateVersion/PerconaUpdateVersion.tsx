import React, { useEffect } from 'react';

import { dateTimeFormat } from '@grafana/data';
import { Modal, useStyles2, Button } from '@grafana/ui';
import { PMM_UPDATES_LINK } from 'app/percona/shared/components/PerconaBootstrapper/PerconaNavigation';
import {
  checkUpdatesChangeLogs,
  setShowUpdateModal,
  UpdatesChangeLogs,
} from 'app/percona/shared/core/reducers/updates';
import { setSnoozedVersion } from 'app/percona/shared/core/reducers/user/user';
import { getPerconaUser, getUpdatesInfo } from 'app/percona/shared/core/selectors';
import { useAppDispatch } from 'app/store/store';
import { useSelector } from 'app/types';

import { Messages } from './PerconaUpdateVersion.constants';
import { getStyles } from './PerconaUpdateVersion.styles';

const PerconaUpdateVersion = () => {
  const { updateAvailable, installed, latest, changeLogs, showUpdateModal } = useSelector(getUpdatesInfo);
  const { snoozedPmmVersion } = useSelector(getPerconaUser);
  const dispatch = useAppDispatch();
  const styles = useStyles2(getStyles);

  useEffect(() => {
    const prepareModal = async () => {
      if (installed?.version === latest?.version || snoozedPmmVersion === latest?.version) {
        dispatch(setShowUpdateModal(false));
      } else {
        await dispatch(checkUpdatesChangeLogs());
      }
    };

    if (updateAvailable) {
      prepareModal();
    }
  }, [dispatch, updateAvailable, installed, latest, snoozedPmmVersion]);

  const snoozeUpdate = async () => {
    if (latest && latest.version) {
      await dispatch(setSnoozedVersion(latest.version));
    }
    dispatch(setShowUpdateModal(false));
  };

  const onDismiss = () => {
    dispatch(setShowUpdateModal(false));
  };

  const onUpdateClick = () => {
    dispatch(setShowUpdateModal(false));
    window.location.assign(PMM_UPDATES_LINK.url!);
  };

  return (
    <>
      <Modal
        onDismiss={onDismiss}
        title={Messages.titleOneUpdate}
        isOpen={showUpdateModal && changeLogs && changeLogs?.updates?.length === 1}
        className={styles.updateVersionModal}
      >
        <div data-testid="one-update-modal">
          <h5 className={styles.version}>{latest?.version || ''}</h5>
          <p className={styles.releaseNotesText}>
            <a target="_blank" rel="noopener noreferrer" href={changeLogs?.updates[0]?.releaseNotesUrl || ''}>
              {Messages.fullReleaseNotes}
            </a>
          </p>
          <h5>{Messages.howToUpdate}</h5>
          <p>{Messages.howToUpdateDescription}</p>
          <div className={styles.updateButtons}>
            <Button type="button" variant="secondary" onClick={snoozeUpdate} className={styles.snoozeButton}>
              {Messages.snooze}
            </Button>
            <Button type="button" variant="primary" onClick={onUpdateClick}>
              {Messages.goToUpdatesPage}
            </Button>
          </div>
        </div>
      </Modal>
      <Modal
        onDismiss={onDismiss}
        title={Messages.titleMultipleUpdates}
        isOpen={showUpdateModal && changeLogs && changeLogs?.updates?.length > 1}
        className={styles.updateVersionModal}
      >
        <div data-testid="multiple-updates-modal">
          <h5 className={styles.newVersionsTitle}>{Messages.newVersions}</h5>
          <ul className={styles.listOfReleaseNotes}>
            {changeLogs?.updates.map((update: UpdatesChangeLogs) => (
              <li key={update.timestamp}>
                <a target="_blank" rel="noopener noreferrer" href={update.releaseNotesUrl}>
                  {update.version}
                  {update.timestamp ? `, ${dateTimeFormat(update.timestamp, { format: 'MMM DD, YYYY' })}` : ''}
                </a>
              </li>
            ))}
          </ul>
          <h5 className={styles.howToUpdate}>{Messages.howToUpdate}</h5>
          <p>{Messages.howToUpdateDescription}</p>
          <div className={styles.updateButtons}>
            <Button type="button" variant="secondary" onClick={snoozeUpdate} className={styles.snoozeButton}>
              {Messages.snooze}
            </Button>
            <Button type="button" variant="primary" onClick={onUpdateClick}>
              {Messages.goToUpdatesPage}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
};

export default PerconaUpdateVersion;
