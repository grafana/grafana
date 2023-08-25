import React from 'react';

import { AlertmanagerPageWrapper } from './components/AlertingPageWrapper';
import AlertmanagerConfig from './components/admin/AlertmanagerConfig';
import { ExternalAlertmanagers } from './components/admin/ExternalAlertmanagers';
import { useAlertmanager } from './state/AlertmanagerContext';
import { GRAFANA_RULES_SOURCE_NAME } from './utils/datasource';

export default function Admin(): JSX.Element {
  return (
    <AlertmanagerPageWrapper pageId="alerting-admin" accessType="notification">
      <AdminPageContents />
    </AlertmanagerPageWrapper>
  );
}

function AdminPageContents() {
  const { selectedAlertmanager } = useAlertmanager();
  const isGrafanaAmSelected = selectedAlertmanager === GRAFANA_RULES_SOURCE_NAME;

  return (
    <>
      <AlertmanagerConfig test-id="admin-alertmanagerconfig" />
      {isGrafanaAmSelected && <ExternalAlertmanagers test-id="admin-externalalertmanagers" />}
    </>
  );
}
