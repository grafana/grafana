import { useState } from 'react';
import { useLocation } from 'react-router-dom-v5-compat';

import { Trans, t } from '@grafana/i18n';
import { Alert, TextLink } from '@grafana/ui';
import { SuggestedDashboardsModal } from 'app/features/dashboard/dashgrid/DashboardLibrary/SuggestedDashboardsModal';
import { DashboardRoutes } from 'app/types/dashboard';

import { DashboardScene } from '../scene/DashboardScene';

interface Props {
  route: string | undefined;
  dashboard: DashboardScene;
  datasource?: string;
}

export function SuggestedDashboardBanner({ route, dashboard, datasource }: Props) {
  const { title } = dashboard.useState();
  const location = useLocation();
  const [dismissed, setDismissed] = useState(false);

  const searchParams = new URLSearchParams(location.search);
  const fromDatasource = searchParams.has('fromDatasource');

  if (route !== DashboardRoutes.Template || !fromDatasource || dismissed) {
    return null;
  }

  searchParams.set('dashboardLibraryDatasourceUid', datasource ?? '');
  const suggestedDashboardsHref = `?${searchParams.toString()}`;

  return (
    <>
      <Alert
        severity="info"
        title={t('dashboard-scene.suggested-dashboard-banner.title', 'You are viewing {{title}}', { title })}
        style={{ flex: 0 }}
        onRemove={() => setDismissed(true)}
      >
        <Trans i18nKey="dashboard-scene.suggested-dashboard-banner.body">
          Not what you&apos;re looking for? View{' '}
          <TextLink href={suggestedDashboardsHref}>other suggested dashboards</TextLink> or{' '}
          <TextLink href="/dashboard/new">create one from scratch</TextLink>.
        </Trans>
      </Alert>
      {/* Modal is URL-driven; renders hidden when ?dashboardLibraryDatasourceUid is absent */}
      <SuggestedDashboardsModal />
    </>
  );
}
