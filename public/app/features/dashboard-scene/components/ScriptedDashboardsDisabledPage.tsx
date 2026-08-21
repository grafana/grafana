import { PageLayoutType } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { Alert, Box, TextLink } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import { SCRIPTED_DASHBOARDS_DEPRECATION_URL } from 'app/features/dashboard/services/DashboardLoaderSrv';

export function ScriptedDashboardsDisabledPage() {
  const title = t('dashboard-scene.scripted-dashboards-disabled.title', 'Scripted dashboards are disabled');

  return (
    <Page navId="dashboards/browse" layout={PageLayoutType.Canvas} pageNav={{ text: title }}>
      <Box display="flex" direction="column" alignItems="center">
        <Alert severity="info" title={title}>
          <Trans i18nKey="dashboard-scene.scripted-dashboards-disabled.body">
            Scripted dashboards are deprecated and will be removed in Grafana 14.{' '}
            <TextLink href={SCRIPTED_DASHBOARDS_DEPRECATION_URL} external>
              Read the deprecation notice
            </TextLink>
            . To temporarily restore them, set the <code>disableScriptedDashboards</code> feature toggle to{' '}
            <code>false</code>.
          </Trans>
        </Alert>
      </Box>
    </Page>
  );
}
