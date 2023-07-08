import React from 'react';
import { Disable, Enable } from 'react-enable';
import { Route, Switch } from 'react-router-dom';

import { withErrorBoundary } from '@grafana/ui';
const ContactPointsV1 = SafeDynamicImport(() => import('./components/contact-points/ContactPoints.v1'));
const ContactPointsV2 = SafeDynamicImport(() => import('./components/contact-points/ContactPoints.v2'));
const EditContactPoint = SafeDynamicImport(() => import('./components/contact-points/EditContactPoint'));
const NewContactPoint = SafeDynamicImport(() => import('./components/contact-points/NewContactPoint'));
import { SafeDynamicImport } from 'app/core/components/DynamicImports/SafeDynamicImport';
import { GrafanaRouteComponentProps } from 'app/core/navigation/types';

import { AlertmanagerPageWrapper } from './components/AlertingPageWrapper';
import { AlertingFeature } from './features';

// TODO add pagenav back in – that way we have correct breadcrumbs and page title
const ContactPoints = (props: GrafanaRouteComponentProps): JSX.Element => (
  <AlertmanagerPageWrapper pageId="receivers" accessType="notification">
    <Enable feature={AlertingFeature.ContactPointsV2}>
      {/* TODO do we want a "routes" component for each Alerting entity? */}
      <Switch>
        <Route exact={true} path="/alerting/notifications" component={ContactPointsV2} />
        <Route exact={true} path="/alerting/notifications/receivers/new" component={NewContactPoint} />
        <Route exact={true} path="/alerting/notifications/receivers/:name/edit" component={EditContactPoint} />
      </Switch>
    </Enable>
    <Disable feature={AlertingFeature.ContactPointsV2}>
      <ContactPointsV1 {...props} />
    </Disable>
  </AlertmanagerPageWrapper>
);

export default withErrorBoundary(ContactPoints, { style: 'page' });
