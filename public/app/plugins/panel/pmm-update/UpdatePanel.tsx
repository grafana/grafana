import React, { FC, MouseEvent, useEffect, useState } from 'react';

import { Button, IconName, Spinner } from '@grafana/ui';
import { SettingsService } from 'app/percona/settings/Settings.service';
import { logger } from 'app/percona/shared/helpers/logger';

import { Messages } from './UpdatePanel.messages';
import * as styles from './UpdatePanel.styles';
import { AvailableUpdate, CurrentVersion, InfoBox, LastCheck, ProgressModal } from './components';
import { usePerformUpdate, useVersionDetails } from './hooks';

export const UpdatePanel: FC<{}> = () => {
  const isOnline = navigator.onLine;
  const [forceUpdate, setForceUpdate] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [updatesDisabled, setUpdatesDisabled] = useState(false);
  const [isLoadingSettings, setLoadingSettings] = useState(true);
  const [hasNoAccess, setHasNoAccess] = useState(false);
  const [
    { installedVersionDetails, lastCheckDate, nextVersionDetails, isUpdateAvailable },
    fetchVersionErrorMessage,
    isLoadingVersionDetails,
    isDefaultView,
    getCurrentVersionDetails,
  ] = useVersionDetails();
  const [output, updateErrorMessage, isUpdated, updateFailed, launchUpdate] = usePerformUpdate();
  const isLoading = isLoadingVersionDetails || isLoadingSettings;

  const getSettings = async () => {
    setLoadingSettings(true);

    try {
      const { updatesDisabled } = await SettingsService.getSettings(undefined, true);

      setUpdatesDisabled(!!updatesDisabled);
    } catch (e) {
      // @ts-ignore
      if (e.response?.status === 401) {
        setHasNoAccess(true);
      }

      logger.error(e);
    }

    setLoadingSettings(false);
  };

  const handleCheckForUpdates = (e: MouseEvent) => {
    if (e.altKey) {
      setForceUpdate(true);
    }

    getCurrentVersionDetails({ force: true });
  };

  useEffect(() => {
    getSettings();
  }, []);

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
        {isUpdateAvailable && !isDefaultView && !updatesDisabled && !hasNoAccess && !isLoading && isOnline ? (
          <AvailableUpdate nextVersionDetails={nextVersionDetails} />
        ) : null}
        {isLoading ? (
          <div className={styles.middleSectionWrapper}>
            <Spinner />
          </div>
        ) : (
          <>
            {(isUpdateAvailable || forceUpdate) && !updatesDisabled && !hasNoAccess && isOnline ? (
              <div className={styles.middleSectionWrapper}>
                {/* eslint-disable-next-line @typescript-eslint/consistent-type-assertions */}
                <Button onClick={handleUpdate} icon={'fa fa-download' as IconName} variant="secondary">
                  {Messages.upgradeTo(nextVersionDetails?.nextVersion)}
                </Button>
              </div>
            ) : (
              <InfoBox
                upToDate={!isDefaultView && !forceUpdate}
                hasNoAccess={hasNoAccess}
                updatesDisabled={updatesDisabled}
                isOnline={isOnline}
              />
            )}
          </>
        )}
        <LastCheck
          disabled={isLoading || updatesDisabled || !isOnline}
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
