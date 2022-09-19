import React from 'react';

import { contextSrv } from 'app/core/services/context_srv';
import { AccessControlAction } from 'app/types';

type Props = {
  actions: AccessControlAction[];
  fallback?: boolean;
};

export const Authorize = ({ actions, children, fallback = true }: React.PropsWithChildren<Props>) => {
  if (actions.some((action) => contextSrv.hasAccess(action, fallback))) {
    return <>{children}</>;
  } else {
    return null;
  }
};
