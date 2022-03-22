import React, { FC } from 'react';
import { AccessControlAction } from 'app/types';
import { contextSrv } from 'app/core/services/context_srv';

type Props = {
  actions: AccessControlAction[];
  fallback?: boolean;
};

export const Authorize: FC<Props> = ({ actions, children, fallback = true }) => {
  if (actions.some((action) => contextSrv.hasAccess(action, fallback))) {
    return <>{children}</>;
  } else {
    return null;
  }
};
