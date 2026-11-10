import { useEffect, useState } from 'react';

import { t } from '@grafana/i18n';
import { Alert, LoadingPlaceholder } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import { useNavModel } from 'app/core/hooks/useNavModel';

import RealDrilldownPage, { getFallbackNavModel } from './RealDrilldownPage';
import { setOverview } from './liveScenario';
import { loadOverview } from './loadScenario';

type State = { kind: 'loading' } | { kind: 'ready' } | { kind: 'error'; message: string };

// Loads the overview from the OTel lab data sources, then renders the copy of the prototype page.
export function RealDataDrilldownPage() {
  const [state, setState] = useState<State>({ kind: 'loading' });
  const hasNav = useNavModel('drilldown').node.id !== 'not-found';

  useEffect(() => {
    let cancelled = false;
    loadOverview()
      .then((overview) => {
        if (!cancelled) {
          setOverview(overview);
          setState({ kind: 'ready' });
        }
      })
      .catch((error: Error) => {
        if (!cancelled) {
          setState({ kind: 'error', message: error.message });
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (state.kind === 'ready') {
    return <RealDrilldownPage />;
  }

  return (
    <Page navId={hasNav ? 'drilldown' : undefined} navModel={hasNav ? undefined : getFallbackNavModel()}>
      <Page.Contents>
        {state.kind === 'loading' && (
          <LoadingPlaceholder text={t('drilldown-real.overview-loading', 'Querying the OTel lab data sources')} />
        )}
        {state.kind === 'error' && (
          <Alert
            severity="error"
            title={t('drilldown-real.overview-error', 'Could not query the OTel lab data sources')}
          >
            {state.message}
          </Alert>
        )}
      </Page.Contents>
    </Page>
  );
}

export default RealDataDrilldownPage;
