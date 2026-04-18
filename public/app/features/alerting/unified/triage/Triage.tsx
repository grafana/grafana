import { t } from '@grafana/i18n';
import { UrlSyncContextProvider } from '@grafana/scenes';
import { withErrorBoundary } from '@grafana/ui';

import { AlertingPageWrapper } from '../components/AlertingPageWrapper';
import { useAlertsNav } from '../navigation/useAlertActivityNav';

import { useApplyDefaultTriageSearch } from './hooks/useApplyDefaultTriageSearch';
import { TriageScene, triageScene } from './scene/TriageScene';

export const TriagePage = () => {
  const { navId, pageNav } = useAlertsNav();
  // Apply default saved search on first visit (if enabled and no active filters)
  useApplyDefaultTriageSearch();

  return (
    <AlertingPageWrapper
      navId={navId}
      pageNav={pageNav}
      subTitle={t(
        'alerting.pages.triage.subtitle',
        'See what is currently alerting and explore historical data to investigate current or past issues.'
      )}
    >
      <UrlSyncContextProvider scene={triageScene} updateUrlOnInit={true} createBrowserHistorySteps={true}>
        <TriageScene key={triageScene.state.key} />
      </UrlSyncContextProvider>
    </AlertingPageWrapper>
  );
};

export default withErrorBoundary(TriagePage);
