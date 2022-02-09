import React from 'react';
import { AlertingPageWrapper } from './components/AlertingPageWrapper';
import AlertmanagerConfig from './components/admin/AlertmanagerConfig';
import { ExternalAlertmanagers } from './components/admin/ExternalAlertmanagers';

export default function Admin(): JSX.Element {
  return (
    <AlertingPageWrapper pageId="alerting-admin">
      <AlertmanagerConfig test-id="admin-alertmanagerconfig" />
      <ExternalAlertmanagers test-id="admin-externalalertmanagers" />
    </AlertingPageWrapper>
  );
}
