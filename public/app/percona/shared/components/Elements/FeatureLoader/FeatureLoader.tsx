import React, { FC, useEffect, useState } from 'react';
import { Spinner, useStyles } from '@grafana/ui';
import { logger } from '@percona/platform-core';
import { SettingsService } from 'app/percona/settings/Settings.service';
import { EmptyBlock } from '../EmptyBlock';
import { FeatureLoaderProps } from './FeatureLoader.types';
import { Messages } from './FeatureLoader.messages';
import { PMM_SETTINGS_URL } from './FeatureLoader.constants';
import { getStyles } from './FeatureLoader.styles';

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

  const getSettings = async () => {
    setLoadingSettings(true);

    try {
      const settings = await SettingsService.getSettings();
      setFeatureEnabled(!!settings[featureFlag]);
    } catch (e) {
      logger.error(e);
      onError(e);
    } finally {
      setLoadingSettings(false);
    }
  };

  useEffect(() => {
    getSettings();
  }, []);

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
