import { t } from '@grafana/i18n';
import { UrlSyncContextProvider } from '@grafana/scenes';
import { withErrorBoundary } from '@grafana/ui';

import { AlertingPageWrapper } from '../components/AlertingPageWrapper';
import { useAlertActivityNav } from '../navigation/useAlertActivityNav';

import { TriageScene, triageScene } from './scene/TriageScene';

export const TriagePage = () => {
  const { navId, pageNav } = useAlertActivityNav();

  return (
    <AlertingPageWrapper navId={navId || 'alert-alerts'} pageNav={pageNav}>
      <UrlSyncContextProvider scene={triageScene} updateUrlOnInit={true} createBrowserHistorySteps={true}>
        <TriageScene key={triageScene.state.key} />
      </UrlSyncContextProvider>
    </AlertingPageWrapper>
  );
};

export default withErrorBoundary(TriagePage);
