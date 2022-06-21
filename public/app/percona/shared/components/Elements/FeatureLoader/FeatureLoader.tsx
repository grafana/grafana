import { logger } from '@percona/platform-core';
import React, { FC, useEffect, useState } from 'react';

import { Spinner, useStyles } from '@grafana/ui';
import { SettingsService } from 'app/percona/settings/Settings.service';
import { isApiCancelError } from 'app/percona/shared/helpers/api';

import { useCancelToken } from '../../hooks/cancelToken.hook';
import { EmptyBlock } from '../EmptyBlock';

import { GET_SETTINGS_CANCEL_TOKEN, PMM_SETTINGS_URL } from './FeatureLoader.constants';
import { Messages } from './FeatureLoader.messages';
import { getStyles } from './FeatureLoader.styles';
import { FeatureLoaderProps } from './FeatureLoader.types';

export const FeatureLoader: FC<FeatureLoaderProps> = ({
  featureName,
  featureFlag,
  messageDataQa = 'settings-link',
  children,
  onError = () => null,
}) => {
  const styles = useStyles(getStyles);
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [featureEnabled, setFeatureEnabled] = useState(false);
  const [generateToken] = useCancelToken();

  useEffect(() => {
    const getSettings = async () => {
      setLoadingSettings(true);

      try {
        const settings = await SettingsService.getSettings(generateToken(GET_SETTINGS_CANCEL_TOKEN));
        setFeatureEnabled(!!settings[featureFlag]);
      } catch (e) {
        if (isApiCancelError(e)) {
          return;
        }
        logger.error(e);
        onError(e);
      }
      setLoadingSettings(false);
    };

    getSettings();
  }, [featureFlag, onError, generateToken]);

  if (featureEnabled) {
    return <>{children}</>;
  }

  return (
    <div className={styles.emptyBlock}>
      <EmptyBlock dataQa="empty-block">
        {loadingSettings ? (
          <Spinner />
        ) : (
          <>
            {Messages.featureDisabled(featureName)}&nbsp;
            <a data-qa={messageDataQa} className={styles.link} href={PMM_SETTINGS_URL}>
              {Messages.pmmSettings}
            </a>
          </>
        )}
      </EmptyBlock>
    </div>
  );
};
