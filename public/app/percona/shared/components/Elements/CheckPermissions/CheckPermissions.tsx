import React, { FC, useEffect, useState } from 'react';
import { Spinner, useStyles } from '@grafana/ui';
import { logger } from '@percona/platform-core';
import { SettingsService } from 'app/percona/settings/Settings.service';
import { EmptyBlock } from 'app/percona/shared/components/Elements/EmptyBlock';
import { CheckPermissionsProps } from './CheckPermissions.types';
import { Messages } from './CheckPermissions.messages';
import { getStyles } from './CheckPermissions.styles';

export const CheckPermissions: FC<CheckPermissionsProps> = ({
  children,
  onSettingsLoadSuccess,
  onSettingsLoadError,
}) => {
  const styles = useStyles(getStyles);
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [hasNoAccess, setHasNoAccess] = useState(false);
  const getSettings = async () => {
    setLoadingSettings(true);
    try {
      const settings = await SettingsService.getSettings(undefined, true);
      onSettingsLoadSuccess && onSettingsLoadSuccess(settings);
    } catch (e) {
      if (e.response?.status === 401) {
        setHasNoAccess(true);
      }
      onSettingsLoadError && onSettingsLoadError();
      logger.error(e);
    }
    setLoadingSettings(false);
  };

  useEffect(() => {
    getSettings();
  }, []);

  if (!loadingSettings && !hasNoAccess) {
    return <>{children}</>;
  }

  return (
    <div className={styles.emptyBlock}>
      <EmptyBlock dataQa="empty-block">
        {loadingSettings ? <Spinner /> : hasNoAccess && <div data-qa="unauthorized">{Messages.unauthorized}</div>}
      </EmptyBlock>
    </div>
  );
};
