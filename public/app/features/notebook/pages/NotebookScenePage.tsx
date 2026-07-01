import { useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom-v5-compat';

import { PageLayoutType } from '@grafana/data';
import { UrlSyncContextProvider } from '@grafana/scenes';
import { Box } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import PageLoader from 'app/core/components/PageLoader/PageLoader';
import { DashboardPageError } from 'app/features/dashboard/containers/DashboardPageError';
import { DashboardRoutes } from 'app/types/dashboard';

import { NotebookScenePageStateManager } from './NotebookScenePageStateManager';

// F6 wires the load path only: fetch a notebook, wrap it into the scene envelope, and
// hand it to the existing transformer via the notebook state manager. Rendering the
// notebook layout itself is F7 — until it registers the NotebookLayout deserializer the
// transform throws, the state manager surfaces it as loadError, and this page shows the
// standard dashboard error state rather than a rendered notebook.
export function NotebookScenePage() {
  const { uid } = useParams();
  const stateManagerRef = useRef<NotebookScenePageStateManager>();
  if (!stateManagerRef.current) {
    stateManagerRef.current = new NotebookScenePageStateManager({});
  }
  const stateManager = stateManagerRef.current;
  // The state field is `dashboard` (shared DashboardScenePageState); aliased here since
  // on this page the DashboardScene always represents a notebook.
  const { dashboard: notebookScene, isLoading, loadError } = stateManager.useState();

  useEffect(() => {
    if (uid) {
      stateManager.loadDashboard({ uid, route: DashboardRoutes.Notebook });
    }

    return () => {
      stateManager.clearState();
    };
  }, [stateManager, uid]);

  if (!notebookScene) {
    return loadError ? (
      <DashboardPageError error={loadError} />
    ) : (
      <Page navId="dashboards/browse" layout={PageLayoutType.Canvas} data-testid="notebook-scene-page">
        <Box paddingY={4} display="flex" direction="column" alignItems="center">
          {isLoading && <PageLoader />}
        </Box>
      </Page>
    );
  }

  return (
    <UrlSyncContextProvider scene={notebookScene} updateUrlOnInit={true} createBrowserHistorySteps={true}>
      <notebookScene.Component model={notebookScene} key={notebookScene.state.key} />
    </UrlSyncContextProvider>
  );
}

export default NotebookScenePage;
