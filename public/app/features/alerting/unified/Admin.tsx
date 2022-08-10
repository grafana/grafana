import React from 'react';

import { AlertingPageWrapper } from './components/AlertingPageWrapper';
import AlertmanagerConfig from './components/admin/AlertmanagerConfig';
import { ExternalAlertmanagers } from './components/admin/ExternalAlertmanagers';
import { useAlertManagerSourceName } from './hooks/useAlertManagerSourceName';
import { useAlertManagersByPermission } from './hooks/useAlertManagerSources';
import { GRAFANA_RULES_SOURCE_NAME } from './utils/datasource';

export default function Admin(): JSX.Element {
  const alertManagers = useAlertManagersByPermission('notification');
  const [alertManagerSourceName] = useAlertManagerSourceName(alertManagers);

  const isGrafanaAmSelected = alertManagerSourceName === GRAFANA_RULES_SOURCE_NAME;

  return (
    <AlertingPageWrapper pageId="alerting-admin">
      <AlertmanagerConfig test-id="admin-alertmanagerconfig" />
      {isGrafanaAmSelected && <ExternalAlertmanagers test-id="admin-externalalertmanagers" />}
    </AlertingPageWrapper>
  );
}
