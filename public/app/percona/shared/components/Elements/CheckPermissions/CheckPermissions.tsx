import React, { FC, useEffect, useState } from 'react';

import { Spinner, useStyles } from '@grafana/ui';
import { SettingsService } from 'app/percona/settings/Settings.service';
import { EmptyBlock } from 'app/percona/shared/components/Elements/EmptyBlock';
import { logger } from 'app/percona/shared/helpers/logger';

import { Messages } from './CheckPermissions.messages';
import { getStyles } from './CheckPermissions.styles';
import { CheckPermissionsProps } from './CheckPermissions.types';

export const CheckPermissions: FC<CheckPermissionsProps> = ({
  children,
  onSettingsLoadSuccess,
  onSettingsLoadError,
}) => {
  const styles = useStyles(getStyles);
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [hasNoAccess, setHasNoAccess] = useState(false);

  useEffect(() => {
    const getSettings = async () => {
      setLoadingSettings(true);
      try {
        const settings = await SettingsService.getSettings(undefined, true);
        onSettingsLoadSuccess && onSettingsLoadSuccess(settings);
      } catch (e) {
        // @ts-ignore
        if (e.response?.status === 401) {
          setHasNoAccess(true);
        }
        onSettingsLoadError && onSettingsLoadError();
        logger.error(e);
      }
      setLoadingSettings(false);
    };
    getSettings();
  }, [onSettingsLoadError, onSettingsLoadSuccess]);

  if (!loadingSettings && !hasNoAccess) {
    return <>{children}</>;
  }

  return (
    <div className={styles.emptyBlock}>
      <EmptyBlock dataTestId="empty-block">
        {loadingSettings ? <Spinner /> : hasNoAccess && <div data-testid="unauthorized">{Messages.unauthorized}</div>}
      </EmptyBlock>
    </div>
  );
};
