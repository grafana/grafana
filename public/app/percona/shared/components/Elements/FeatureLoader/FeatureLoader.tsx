import React, { FC } from 'react';

import { useStyles } from '@grafana/ui';

import { PermissionLoader } from '../PermissionLoader';

import { PMM_SETTINGS_URL } from './FeatureLoader.constants';
import { Messages } from './FeatureLoader.messages';
import { getStyles } from './FeatureLoader.styles';
import { FeatureLoaderProps } from './FeatureLoader.types';

export const FeatureLoader: FC<FeatureLoaderProps> = ({
  featureName,
  featureSelector,
  messagedataTestId = 'settings-link',
  children,
}) => {
  const styles = useStyles(getStyles);

  return (
    <PermissionLoader
      featureSelector={featureSelector}
      renderSuccess={() => children}
      renderError={() => (
        <>
          {Messages.featureDisabled(featureName)}&nbsp;
          <a data-testid={messagedataTestId} className={styles.link} href={PMM_SETTINGS_URL}>
            {Messages.pmmSettings}
          </a>
        </>
      )}
    />
  );
};
