import React, { FC, useCallback } from 'react';
import { StoreState } from 'app/types';
import { Messages } from './PlatformConnectedLoader.messages';
import { PermissionLoader } from '../PermissionLoader';
import { useSelector } from 'react-redux';
import { getPerconaUser } from 'app/percona/shared/core/selectors';
import { EmptyBlock } from '../EmptyBlock';
import { ErrorMessage } from './components/ErrorMessage/ErrorMessage';

export const PlatformConnectedLoader: FC = ({ children }) => {
  const featureSelector = useCallback((state: StoreState) => !!state.perconaSettings.isConnectedToPortal, []);
  const { isPlatformUser } = useSelector(getPerconaUser);

  const checkForPlatformUser = useCallback(() => {
    if (isPlatformUser) {
      return children;
    }
    return <EmptyBlock dataTestId="not-platform-user">{Messages.platformUser}</EmptyBlock>;
  }, [isPlatformUser, children]);

  return (
    <PermissionLoader
      featureSelector={featureSelector}
      renderSuccess={checkForPlatformUser}
      renderError={() => <ErrorMessage />}
    />
  );
};
