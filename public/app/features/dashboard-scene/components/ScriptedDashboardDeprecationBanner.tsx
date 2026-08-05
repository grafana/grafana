import { useState } from 'react';

import { Trans, t } from '@grafana/i18n';
import { Alert, Box, TextLink } from '@grafana/ui';
import { SCRIPTED_DASHBOARDS_DEPRECATION_URL } from 'app/features/dashboard/services/DashboardLoaderSrv';

interface ScriptedDashboardDeprecationBannerProps {
  // Whether the current dashboard is a scripted dashboard. Derived from the route type rather than
  // dashboard meta, because `fromScript` is dropped by the v2 response transformer.
  isScripted: boolean;
}

export function ScriptedDashboardDeprecationBanner({ isScripted }: ScriptedDashboardDeprecationBannerProps) {
  const [dismissed, setDismissed] = useState(false);

  if (!isScripted || dismissed) {
    return null;
  }

  return (
    <Box paddingX={2} paddingTop={2}>
      <Alert
        severity="warning"
        title={t('dashboard-scene.scripted-dashboard-deprecation-banner.title', 'Scripted dashboards are deprecated')}
        style={{ flex: 0 }}
        onRemove={() => setDismissed(true)}
      >
        <Trans i18nKey="dashboard-scene.scripted-dashboard-deprecation-banner.body">
          This feature will be removed in Grafana 14.{' '}
          <TextLink href={SCRIPTED_DASHBOARDS_DEPRECATION_URL} external>
            Read the deprecation notice
          </TextLink>
          .
        </Trans>
      </Alert>
    </Box>
  );
}
