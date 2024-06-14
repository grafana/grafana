import React from 'react';
import { Route, Switch } from 'react-router-dom';

import { withErrorBoundary } from '@grafana/ui';
import { SafeDynamicImport } from 'app/core/components/DynamicImports/SafeDynamicImport';

import { AlertmanagerPageWrapper } from './components/AlertingPageWrapper';

const ContactPointsV2 = SafeDynamicImport(() => import('./components/contact-points/ContactPoints'));
const EditContactPoint = SafeDynamicImport(() => import('./components/contact-points/EditContactPoint'));
const NewContactPoint = SafeDynamicImport(() => import('./components/contact-points/NewContactPoint'));
const GlobalConfig = SafeDynamicImport(() => import('./components/contact-points/components/GlobalConfig'));

const ContactPoints = (): JSX.Element => (
  <AlertmanagerPageWrapper navId="receivers" accessType="notification">
    <Switch>
      <Route exact={true} path="/alerting/notifications" component={ContactPointsV2} />
      <Route exact={true} path="/alerting/notifications/receivers/new" component={NewContactPoint} />
      <Route exact={true} path="/alerting/notifications/receivers/:name/edit" component={EditContactPoint} />
      <Route exact={true} path="/alerting/notifications/global-config" component={GlobalConfig} />
    </Switch>
  </AlertmanagerPageWrapper>
);

export default withErrorBoundary(ContactPoints, { style: 'page' });
