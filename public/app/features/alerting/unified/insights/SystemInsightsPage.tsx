import { AlertingPageWrapper } from '../components/AlertingPageWrapper';
import { getInsightsScenes, insightsIsAvailable } from '../home/Insights';
import { useSystemInsightsNav } from '../navigation/useInsightsNav';
import { isLocalDevEnv } from '../utils/misc';
import { withPageErrorBoundary } from '../withPageErrorBoundary';

function SystemInsightsPage() {
  const { navId, pageNav } = useSystemInsightsNav();
  const insightsEnabled = Boolean(insightsIsAvailable()) || isLocalDevEnv();
  const insightsScene = getInsightsScenes();

  return (
    <AlertingPageWrapper navId={navId} pageNav={pageNav} isLoading={false}>
      {insightsEnabled && <insightsScene.Component model={insightsScene} />}
    </AlertingPageWrapper>
  );
}

export default withPageErrorBoundary(SystemInsightsPage);
