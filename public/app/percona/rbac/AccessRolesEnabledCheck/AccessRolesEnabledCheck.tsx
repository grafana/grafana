import { FC, PropsWithChildren } from 'react';

import { getPerconaSettings } from 'app/percona/shared/core/selectors';
import { useSelector } from 'app/types';

const AccessRolesEnabledCheck: FC<PropsWithChildren> = ({ children }) => {
  const { result: settings } = useSelector(getPerconaSettings);

  if (!settings?.enableAccessControl) {
    return null;
  }

  return <>{children}</>;
};

export default AccessRolesEnabledCheck;
