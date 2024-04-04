import React from 'react';
import { Route, Switch } from 'react-router-dom';

import { withErrorBoundary } from '@grafana/ui';
import { SafeDynamicImport } from 'app/core/components/DynamicImports/SafeDynamicImport';
import { GrafanaRouteComponentProps } from 'app/core/navigation/types';

import { AlertmanagerPageWrapper } from './components/AlertingPageWrapper';

const EditMessageTemplate = SafeDynamicImport(() => import('./components/contact-points/EditMessageTemplate'));
const NewMessageTemplate = SafeDynamicImport(() => import('./components/contact-points/NewMessageTemplate'));
const DuplicateMessageTemplate = SafeDynamicImport(
  () => import('./components/contact-points/DuplicateMessageTemplate')
);

const NotificationTemplates = (_props: GrafanaRouteComponentProps): JSX.Element => (
  <AlertmanagerPageWrapper
    navId="receivers"
    accessType="notification"
    pageNav={{ id: 'templates', text: 'Notification templates', subTitle: 'Create and edit notification templates' }}
  >
    <Switch>
      <Route exact={true} path="/alerting/notifications/templates/:name/edit" component={EditMessageTemplate} />
      <Route exact={true} path="/alerting/notifications/templates/new" component={NewMessageTemplate} />
      <Route
        exact={true}
        path="/alerting/notifications/templates/:name/duplicate"
        component={DuplicateMessageTemplate}
      />
    </Switch>
  </AlertmanagerPageWrapper>
);

export default withErrorBoundary(NotificationTemplates, { style: 'page' });
