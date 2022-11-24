import React, { FC, Suspense } from 'react';
import { lazily } from 'react-lazily';

import { FNDashboardProps } from '../types';

const { RenderFNDashboard } = lazily(() => import('./render-fn-dashboard'));
const { FnAppProvider } = lazily(() => import('../fn-app-provider'));
const { AngularRoot } = lazily(() => import('../../angular/AngularRoot'));

export const FNDashboard: FC<FNDashboardProps> = (props) => (
  <Suspense fallback={<>{props.fnLoader}</>}>
    <FnAppProvider fnError={props.fnError}>
      <div className="page-dashboard">
        <AngularRoot />
        <RenderFNDashboard {...props} />
      </div>
    </FnAppProvider>
  </Suspense>
);
