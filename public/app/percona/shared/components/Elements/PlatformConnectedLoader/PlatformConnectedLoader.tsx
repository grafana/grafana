import React, { FC } from 'react';
import { Messages } from './PlatformConnectedLoader.messages';
import { useSelector } from 'react-redux';
import { getPerconaSettings, getPerconaUser } from 'app/percona/shared/core/selectors';
import { EmptyBlock } from '../EmptyBlock';

export const PlatformConnectedLoader: FC = ({ children }) => {
  const { isConnectedToPortal } = useSelector(getPerconaSettings);
  const { isPlatformUser, isAuthorized } = useSelector(getPerconaUser);

  if (isPlatformUser) {
    return <>{children}</>;
  } else {
    if (isConnectedToPortal) {
      return <EmptyBlock dataTestId="not-platform-user">{Messages.platformUser}</EmptyBlock>;
    } else {
      if (!isAuthorized) {
        return <EmptyBlock dataTestId="unauthorized">{Messages.unauthorized}</EmptyBlock>;
      }
      return <EmptyBlock dataTestId="not-connected-platform">{Messages.notConnected}</EmptyBlock>;
    }
  }
};
