import React, { FC } from 'react';

import { Spinner, useStyles } from '@grafana/ui';
import { EmptyBlock } from 'app/percona/shared/components/Elements/EmptyBlock';

import { PMM_SETTINGS_URL } from './IntegratedAlertingContent.constants';
import { Messages } from './IntegratedAlertingContent.messages';
import { getStyles } from './IntegratedAlertingContent.styles';
import { IntegratedAlertingContentProps } from './IntegratedAlertingContent.types';

export const IntegratedAlertingContent: FC<IntegratedAlertingContentProps> = ({
  loadingSettings,
  alertingEnabled,
  children,
}) => {
  const styles = useStyles(getStyles);
  if (alertingEnabled) {
    return <>{children}</>;
  }

  return (
    <div className={styles.emptyBlock}>
      <EmptyBlock dataQa="ia-empty-block">
        {loadingSettings ? (
          <Spinner />
        ) : (
          <>
            {Messages.alertingDisabled}&nbsp;
            <a data-qa="ia-settings-link" className={styles.link} href={PMM_SETTINGS_URL}>
              {Messages.pmmSettings}
            </a>
          </>
        )}
      </EmptyBlock>
    </div>
  );
};
