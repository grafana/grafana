import React, { FC } from 'react';

import { useStyles } from '@grafana/ui';
import { getPerconaUser } from 'app/percona/shared/core/selectors';
import { useSelector } from 'app/types';

import { PermissionLoader } from '../PermissionLoader';

import { PMM_SETTINGS_URL } from './FeatureLoader.constants';
import { Messages } from './FeatureLoader.messages';
import { getStyles } from './FeatureLoader.styles';
import { FeatureLoaderProps } from './FeatureLoader.types';

export const FeatureLoader: FC<React.PropsWithChildren<FeatureLoaderProps>> = ({
  featureName = '',
  featureSelector = () => true,
  messagedataTestId = 'settings-link',
  children,
}) => {
  const { isAuthorized } = useSelector(getPerconaUser);
  const styles = useStyles(getStyles);

  if (isAuthorized === false) {
    return (
      <div data-testid="unauthorized" className={styles.unauthorized}>
        {Messages.unauthorized}
      </div>
    );
  }

  return (
    <PermissionLoader
      featureSelector={featureSelector}
      renderSuccess={() => children}
      renderError={() =>
        featureName ? (
          <>
            {Messages.featureDisabled(featureName)}&nbsp;
            {featureName && (
              <a data-testid={messagedataTestId} className={styles.link} href={PMM_SETTINGS_URL}>
                {Messages.pmmSettings}
              </a>
            )}
          </>
        ) : (
          Messages.genericFeatureDisabled
        )
      }
    />
  );
};
