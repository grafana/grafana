import React, { FC, useCallback } from 'react';
import { useStyles } from '@grafana/ui';
import { StoreState } from 'app/types';
import { Messages } from './PlatformConnectedLoader.messages';
import { PLATFORM_SETTINGS_URL } from './PlatformConnectedLoader.constants';
import { getStyles } from './PlatformConnectedLoader.styles';
import { PermissionLoader } from '../PermissionLoader';

export const PlatformConnectedLoader: FC = ({ children }) => {
  const styles = useStyles(getStyles);
  const featureSelector = useCallback((state: StoreState) => !!state.perconaUser.isPlatformUser, []);

  return (
    <PermissionLoader
      featureSelector={featureSelector}
      renderSuccess={() => children}
      renderError={() => (
        <>
          {Messages.notConnected}&nbsp;
          <a data-testid="platform-link" className={styles.link} href={PLATFORM_SETTINGS_URL}>
            {Messages.portalSettings}
          </a>
        </>
      )}
    />
  );
};
