import React from 'react';

import { AlertingPageWrapper } from './components/AlertingPageWrapper';
import AlertmanagerConfig from './components/admin/AlertmanagerConfig';
import { ExternalAlertmanagers } from './components/admin/ExternalAlertmanagers';
import { useSelectedAlertmanager } from './state/AlertmanagerContext';
import { GRAFANA_RULES_SOURCE_NAME } from './utils/datasource';

export default function Admin(): JSX.Element {
  return (
    <AlertingPageWrapper pageId="alerting-admin" includeAlertmanagerSelector>
      <AdminPageContents />
    </AlertingPageWrapper>
  );
}

function AdminPageContents() {
  const { selectedAlertmanager } = useSelectedAlertmanager();
  const isGrafanaAmSelected = selectedAlertmanager === GRAFANA_RULES_SOURCE_NAME;

  return (
    <>
      <AlertmanagerConfig test-id="admin-alertmanagerconfig" />
      {isGrafanaAmSelected && <ExternalAlertmanagers test-id="admin-externalalertmanagers" />}
    </>
  );
}
