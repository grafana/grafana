import React, { FC, MouseEvent, useState } from 'react';

import { Button, Spinner } from '@grafana/ui';
import { PMM_UPDATES_LINK } from 'app/percona/shared/components/PerconaBootstrapper/PerconaNavigation';
import { checkUpdatesAction } from 'app/percona/shared/core/reducers/updates';
import { getPerconaUser, getPerconaSettings, getUpdatesInfo } from 'app/percona/shared/core/selectors';
import { useAppDispatch } from 'app/store/store';
import { useSelector } from 'app/types';

import { Messages } from './UpdatePanel.messages';
import { styles } from './UpdatePanel.styles';
import { formatDateWithTime } from './UpdatePanel.utils';
import { AvailableUpdate, CurrentVersion, InfoBox, LastCheck } from './components';

export const UpdatePanel: FC = () => {
  const isOnline = navigator.onLine;
  const {
    isLoading: isLoadingVersionDetails,
    installed,
    latest,
    latestNewsUrl,
    updateAvailable,
    lastChecked,
  } = useSelector(getUpdatesInfo);
  const { result: settings, loading: isLoadingSettings } = useSelector(getPerconaSettings);
  const dispatch = useAppDispatch();
  const [forceUpdate, setForceUpdate] = useState(false);
  const { isAuthorized } = useSelector(getPerconaUser);
  const isDefaultView = !latest;
  const isLoading = isLoadingVersionDetails || isLoadingSettings;

  const handleCheckForUpdates = (e: MouseEvent) => {
    if (e.altKey) {
      setForceUpdate(true);
    }

    dispatch(checkUpdatesAction());
  };

  const handleOpenUpdates = () => {
    window.location.assign(PMM_UPDATES_LINK.url!);
  };

  return (
    <>
      <div className={styles.panel}>
        {!!installed && <CurrentVersion currentVersion={installed} />}
        {updateAvailable && !isDefaultView && settings?.updatesEnabled && isAuthorized && !isLoading && isOnline ? (
          <AvailableUpdate nextVersion={latest} newsLink={latestNewsUrl} />
        ) : null}
        {isLoading ? (
          <div className={styles.middleSectionWrapper}>
            <Spinner />
          </div>
        ) : (
          <>
            {(updateAvailable || forceUpdate) && settings?.updatesEnabled && isAuthorized && isOnline ? (
              <div className={styles.middleSectionWrapper}>
                <Button onClick={handleOpenUpdates} icon="download-alt" variant="secondary">
                  {!!latest?.version ? Messages.upgradeTo(latest.version) : Messages.upgrade}
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
          lastCheckDate={lastChecked ? formatDateWithTime(lastChecked) : ''}
        />
      </div>
    </>
  );
};
