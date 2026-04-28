import { useState } from 'react';
import { useLocation } from 'react-router-dom-v5-compat';

import { Trans, t } from '@grafana/i18n';
import { Alert, TextLink } from '@grafana/ui';
import {
  CONTENT_KINDS,
  EVENT_LOCATIONS,
  SOURCE_ENTRY_POINTS,
} from 'app/features/dashboard/dashgrid/DashboardLibrary/constants';
import { DashboardLibraryInteractions } from 'app/features/dashboard/dashgrid/DashboardLibrary/interactions';
import { SuggestedDashboardsLoader } from 'app/features/datasources/components/SuggestedDashboardsLoader';
import { DashboardRoutes } from 'app/types/dashboard';

import { type DashboardScene } from '../scene/DashboardScene';

interface Props {
  route?: string;
  dashboard: DashboardScene;
}

export function SuggestedDashboardsBanner({ route, dashboard }: Props) {
  const { title } = dashboard.useState();
  const location = useLocation();
  const [dismissed, setDismissed] = useState(false);

  const searchParams = new URLSearchParams(location.search);
  const suggestedDashboardBanner = searchParams.get('suggestedDashboardBanner') === 'true';
  const datasourceUid = searchParams.get('datasource');

  if (route !== DashboardRoutes.Template || !suggestedDashboardBanner || dismissed || !datasourceUid) {
    return null;
  }

  const onSuggestedDashboardsClick = (onClick: () => void) => {
    DashboardLibraryInteractions.entryPointClicked({
      entryPoint: SOURCE_ENTRY_POINTS.DASHBOARD_PAGE_SUGGESTED_DASHBOARDS_BANNER,
      contentKind: CONTENT_KINDS.SUGGESTED_DASHBOARDS,
    });
    onClick();
  };

  const onCreateFromScratchClick = () => {
    DashboardLibraryInteractions.createFromScratchClicked({
      eventLocation: EVENT_LOCATIONS.DASHBOARD_PAGE_SUGGESTED_DASHBOARDS_BANNER,
    });
  };

  return (
    <SuggestedDashboardsLoader
      datasourceUid={datasourceUid}
      sourceEntryPoint={SOURCE_ENTRY_POINTS.DASHBOARD_PAGE_SUGGESTED_DASHBOARDS_BANNER}
    >
      {({ openModal }) => (
        <Alert
          severity="info"
          title={t('dashboard-scene.suggested-dashboard-banner.title', 'You are viewing {{title}}', {
            title,
            interpolation: { escapeValue: false },
          })}
          style={{ flex: 0 }}
          onRemove={() => setDismissed(true)}
        >
          <Trans i18nKey="dashboard-scene.suggested-dashboard-banner.body">
            Not what you&apos;re looking for? View{' '}
            <TextLink href={window.location.href} onClick={() => onSuggestedDashboardsClick(openModal)}>
              other suggested dashboards
            </TextLink>{' '}
            or{' '}
            <TextLink href="/dashboard/new" onClick={onCreateFromScratchClick}>
              create one from scratch
            </TextLink>
            .
          </Trans>
        </Alert>
      )}
    </SuggestedDashboardsLoader>
  );
}
