import React, { FC } from 'react';
import { useSelector } from 'react-redux';
import { Spinner, useStyles } from '@grafana/ui';
import { getPerconaSettings, getPerconaUser } from 'app/percona/shared/core/selectors';
import { EmptyBlock } from '../EmptyBlock';
import { FeatureLoaderProps } from './FeatureLoader.types';
import { Messages } from './FeatureLoader.messages';
import { PMM_SETTINGS_URL } from './FeatureLoader.constants';
import { getStyles } from './FeatureLoader.styles';

export const FeatureLoader: FC<FeatureLoaderProps> = ({
  featureName,
  featureSelector,
  messagedataTestId = 'settings-link',
  children,
}) => {
  const styles = useStyles(getStyles);
  const featureEnabled = useSelector(featureSelector);
  const { isAuthorized } = useSelector(getPerconaUser);
  const { isLoading } = useSelector(getPerconaSettings);

  if (featureEnabled) {
    return <>{children}</>;
  }

  return (
    <div className={styles.emptyBlock}>
      <EmptyBlock dataTestId="empty-block">
        {isLoading ? (
          <Spinner />
        ) : isAuthorized ? (
          <>
            {Messages.featureDisabled(featureName)}&nbsp;
            <a data-testid={messagedataTestId} className={styles.link} href={PMM_SETTINGS_URL}>
              {Messages.pmmSettings}
            </a>
          </>
        ) : (
          <div data-testid="unauthorized">{Messages.unauthorized}</div>
        )}
      </EmptyBlock>
    </div>
  );
};
