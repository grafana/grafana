import { Trans, t } from '@grafana/i18n';

import { AlertingPageWrapper } from '../components/AlertingPageWrapper';
import { getInsightsScenes, insightsIsAvailable } from '../home/Insights';
import { useInsightsNav } from '../navigation/useInsightsNav';
import { isLocalDevEnv } from '../utils/misc';
import { withPageErrorBoundary } from '../withPageErrorBoundary';

function InsightsPage() {
  const insightsEnabled = insightsIsAvailable() || isLocalDevEnv();
  const insightsScene = getInsightsScenes();
  const { navId, pageNav } = useInsightsNav();

  if (!insightsEnabled) {
    return (
      <AlertingPageWrapper
        navId={navId || 'insights'}
        pageNav={pageNav}
        subTitle={t('alerting.insights.subtitle', 'Analytics and history for alerting')}
      >
        <div>
          <Trans i18nKey="alerting.insights.not-available">
            Insights are not available. Please configure the required data sources.
          </Trans>
        </div>
      </AlertingPageWrapper>
    );
  }

  return (
    <AlertingPageWrapper
      navId={navId || 'insights'}
      pageNav={pageNav}
      subTitle={t('alerting.insights.subtitle', 'Analytics and history for alerting')}
    >
      <insightsScene.Component model={insightsScene} />
    </AlertingPageWrapper>
  );
}

export default withPageErrorBoundary(InsightsPage);
