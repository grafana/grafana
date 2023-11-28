import React from 'react';
import { Route, Switch } from 'react-router-dom';

import { config } from '@grafana/runtime';
import { withErrorBoundary } from '@grafana/ui';
const ContactPointsV1 = SafeDynamicImport(() => import('./components/contact-points/ContactPoints.v1'));
const ContactPointsV2 = SafeDynamicImport(() => import('./components/contact-points/ContactPoints.v2'));
const EditContactPoint = SafeDynamicImport(() => import('./components/contact-points/EditContactPoint'));
const NewContactPoint = SafeDynamicImport(() => import('./components/contact-points/NewContactPoint'));
const EditMessageTemplate = SafeDynamicImport(() => import('./components/contact-points/EditMessageTemplate'));
const NewMessageTemplate = SafeDynamicImport(() => import('./components/contact-points/NewMessageTemplate'));
const GlobalConfig = SafeDynamicImport(() => import('./components/contact-points/GlobalConfig'));
const DuplicateMessageTemplate = SafeDynamicImport(
  () => import('./components/contact-points/DuplicateMessageTemplate')
);
import { SafeDynamicImport } from 'app/core/components/DynamicImports/SafeDynamicImport';
import { GrafanaRouteComponentProps } from 'app/core/navigation/types';

import { AlertmanagerPageWrapper } from './components/AlertingPageWrapper';

const newContactPointsListView = config.featureToggles.alertingContactPointsV2 ?? false;

// TODO add pagenav back in – that way we have correct breadcrumbs and page title
const ContactPoints = (props: GrafanaRouteComponentProps): JSX.Element => (
  <AlertmanagerPageWrapper navId="receivers" accessType="notification">
    {/* TODO do we want a "routes" component for each Alerting entity? */}
    {newContactPointsListView ? (
      <Switch>
        <Route exact={true} path="/alerting/notifications" component={ContactPointsV2} />
        <Route exact={true} path="/alerting/notifications/receivers/new" component={NewContactPoint} />
        <Route exact={true} path="/alerting/notifications/receivers/:name/edit" component={EditContactPoint} />
        <Route exact={true} path="/alerting/notifications/templates/:name/edit" component={EditMessageTemplate} />
        <Route exact={true} path="/alerting/notifications/templates/new" component={NewMessageTemplate} />
        <Route
          exact={true}
          path="/alerting/notifications/templates/:name/duplicate"
          component={DuplicateMessageTemplate}
        />
        <Route exact={true} path="/alerting/notifications/global-config" component={GlobalConfig} />
      </Switch>
    ) : (
      <ContactPointsV1 {...props} />
    )}
  </AlertmanagerPageWrapper>
);

export default withErrorBoundary(ContactPoints, { style: 'page' });
