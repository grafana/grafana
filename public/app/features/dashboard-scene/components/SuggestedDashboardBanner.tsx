import { useState } from 'react';
import { useLocation } from 'react-router-dom-v5-compat';

import { Trans, t } from '@grafana/i18n';
import { Alert, Button, TextLink } from '@grafana/ui';
import { SuggestedDashboardsLoader } from 'app/features/datasources/components/SuggestedDashboardsLoader';
import { DashboardRoutes } from 'app/types/dashboard';

import { DashboardScene } from '../scene/DashboardScene';

interface Props {
  route: string | undefined;
  dashboard: DashboardScene;
  datasourceUid?: string;
}

export function SuggestedDashboardBanner({ route, dashboard, datasourceUid }: Props) {
  const { title } = dashboard.useState();
  const location = useLocation();
  const [dismissed, setDismissed] = useState(false);

  const searchParams = new URLSearchParams(location.search);
  const suggestedDashboardBanner = searchParams.get('suggestedDashboardBanner') === 'true';

  if (route !== DashboardRoutes.Template || !suggestedDashboardBanner || dismissed || !datasourceUid) {
    return null;
  }

  return (
    <SuggestedDashboardsLoader datasourceUid={datasourceUid} fetchOnMount>
      {({ openModal }) => (
        <Alert
          severity="info"
          title={t('dashboard-scene.suggested-dashboard-banner.title', 'You are viewing {{title}}', { title })}
          style={{ flex: 0 }}
          onRemove={() => setDismissed(true)}
        >
          <Trans i18nKey="dashboard-scene.suggested-dashboard-banner.body">
            Not what you&apos;re looking for? View{' '}
            <Button variant="secondary" onClick={openModal}>
              other suggested dashboards
            </Button>{' '}
            or <TextLink href="/dashboard/new">create one from scratch</TextLink>.
          </Trans>
        </Alert>
      )}
    </SuggestedDashboardsLoader>
  );
}
