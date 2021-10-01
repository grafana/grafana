import React, { FC, useEffect, useState } from 'react';
import { Spinner, useStyles } from '@grafana/ui';
import { logger } from '@percona/platform-core';
import { isApiCancelError } from 'app/percona/shared/helpers/api';
import { SettingsService } from 'app/percona/settings/Settings.service';
import { useCancelToken } from '../../hooks/cancelToken.hook';
import { EmptyBlock } from '../EmptyBlock';
import { FeatureLoaderProps } from './FeatureLoader.types';
import { Messages } from './FeatureLoader.messages';
import { GET_SETTINGS_CANCEL_TOKEN, PMM_SETTINGS_URL } from './FeatureLoader.constants';
import { getStyles } from './FeatureLoader.styles';

export const FeatureLoader: FC<FeatureLoaderProps> = ({
  featureName,
  featureFlag,
  messagedataTestId = 'settings-link',
  children,
  onError = () => null,
}) => {
  const styles = useStyles(getStyles);
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [featureEnabled, setFeatureEnabled] = useState(false);
  const [hasNoAccess, setHasNoAccess] = useState(false);
  const [generateToken] = useCancelToken();

  const getSettings = async () => {
    setLoadingSettings(true);
    try {
      const settings = await SettingsService.getSettings(generateToken(GET_SETTINGS_CANCEL_TOKEN), true);
      setFeatureEnabled(!!settings[featureFlag]);
    } catch (e) {
      if (isApiCancelError(e)) {
        return;
      }
      if (e.response?.status === 401) {
        setHasNoAccess(true);
      }
      logger.error(e);
      onError(e);
    }
    setLoadingSettings(false);
  };

  useEffect(() => {
    getSettings();
  }, []);

  if (featureEnabled) {
    return <>{children}</>;
  }

  return (
    <div className={styles.emptyBlock}>
      <EmptyBlock dataTestId="empty-block">
        {loadingSettings ? (
          <Spinner />
        ) : hasNoAccess ? (
          <div data-testid="unauthorized">{Messages.unauthorized}</div>
        ) : (
          <>
            {Messages.featureDisabled(featureName)}&nbsp;
            <a data-testid={messagedataTestId} className={styles.link} href={PMM_SETTINGS_URL}>
              {Messages.pmmSettings}
            </a>
          </>
        )}
      </EmptyBlock>
    </div>
  );
};
