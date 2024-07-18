import React, { FC, MouseEvent, useEffect, useState } from 'react';

import { Button, IconName, Spinner } from '@grafana/ui';
import { getPerconaUser, getPerconaSettings } from 'app/percona/shared/core/selectors';
import { useSelector } from 'app/types';

import { Messages } from './UpdatePanel.messages';
import * as styles from './UpdatePanel.styles';
import { AvailableUpdate, CurrentVersion, InfoBox, LastCheck, ProgressModal } from './components';
import { usePerformUpdate, useVersionDetails } from './hooks';

export const UpdatePanel: FC<{}> = () => {
  const isOnline = navigator.onLine;
  const [forceUpdate, setForceUpdate] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const { isAuthorized } = useSelector(getPerconaUser);
  const { result: settings, loading: isLoadingSettings } = useSelector(getPerconaSettings);
  const [
    { installedVersionDetails, lastCheckDate, nextVersionDetails, isUpdateAvailable },
    fetchVersionErrorMessage,
    isLoadingVersionDetails,
    isDefaultView,
    getCurrentVersionDetails,
  ] = useVersionDetails();
  const [output, updateErrorMessage, isUpdated, updateFailed, launchUpdate] = usePerformUpdate();
  const isLoading = isLoadingVersionDetails || isLoadingSettings;

  const handleCheckForUpdates = (e: MouseEvent) => {
    if (e.altKey) {
      setForceUpdate(true);
    }

    getCurrentVersionDetails({ force: true });
  };

  useEffect(() => {
    setErrorMessage(fetchVersionErrorMessage || updateErrorMessage);

    const timeout = setTimeout(() => {
      setErrorMessage('');
    }, 5000);

    return () => {
      clearTimeout(timeout);
    };
  }, [fetchVersionErrorMessage, updateErrorMessage]);

  const handleUpdate = () => {
    setShowModal(true);
    launchUpdate();
  };

  return (
    <>
      <div className={styles.panel}>
        <CurrentVersion installedVersionDetails={installedVersionDetails} />
        {isUpdateAvailable && !isDefaultView && settings?.updatesEnabled && isAuthorized && !isLoading && isOnline ? (
          <AvailableUpdate nextVersionDetails={nextVersionDetails} />
        ) : null}
        {isLoading ? (
          <div className={styles.middleSectionWrapper}>
            <Spinner />
          </div>
        ) : (
          <>
            {(isUpdateAvailable || forceUpdate) && settings?.updatesEnabled && isAuthorized && isOnline ? (
              <div className={styles.middleSectionWrapper}>
                {/* eslint-disable-next-line @typescript-eslint/consistent-type-assertions */}
                <Button onClick={handleUpdate} icon={'fa fa-download' as IconName} variant="secondary">
                  {Messages.upgradeTo(nextVersionDetails?.nextVersion)}
                </Button>
              </div>
            ) : (
              <InfoBox
                upToDate={!isDefaultView && !forceUpdate}
                hasNoAccess={!isAuthorized}
                updatesDisabled={!settings?.updatesEnabled}
                isOnline={isOnline}
              />
            )}
          </>
        )}
        <LastCheck
          disabled={isLoading || !settings?.updatesEnabled || !isOnline}
          onCheckForUpdates={handleCheckForUpdates}
          lastCheckDate={lastCheckDate}
        />
      </div>
      <ProgressModal
        errorMessage={errorMessage}
        isOpen={showModal}
        isUpdated={isUpdated}
        output={output}
        updateFailed={updateFailed}
        version={nextVersionDetails?.nextVersion}
      />
    </>
  );
};
