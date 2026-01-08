import { t } from '@grafana/i18n';
import { UrlSyncContextProvider } from '@grafana/scenes';
import { withErrorBoundary } from '@grafana/ui';

import { AlertingPageWrapper } from '../components/AlertingPageWrapper';
import { shouldUseAlertingNavigationV2 } from '../featureToggles';

import { TriageScene, triageScene } from './scene/TriageScene';

export const TriagePage = () => {
  const useV2Nav = shouldUseAlertingNavigationV2();
  const navId = useV2Nav ? 'alert-activity' : 'alert-alerts';

  return (
    <AlertingPageWrapper
      navId={navId}
      subTitle={t(
        'alerting.pages.triage.subtitle',
        'See what is currently alerting and explore historical data to investigate current or past issues.'
      )}
      renderTitle={() => t('alerting.pages.triage.title', 'Alert Activity')}
    >
      <UrlSyncContextProvider scene={triageScene} updateUrlOnInit={true} createBrowserHistorySteps={true}>
        <TriageScene key={triageScene.state.key} />
      </UrlSyncContextProvider>
    </AlertingPageWrapper>
  );
};

export default withErrorBoundary(TriagePage);
