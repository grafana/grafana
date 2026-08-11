import { useEffect } from 'react';
import { useParams } from 'react-router-dom-v5-compat';

import { PageLayoutType } from '@grafana/data';
import { useFlagDashboardNotebooks } from '@grafana/runtime/internal';
import { UrlSyncContextProvider } from '@grafana/scenes';
import { Box } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import PageLoader from 'app/core/components/PageLoader/PageLoader';
import { PageNotFound } from 'app/core/components/PageNotFound/PageNotFound';
import { DashboardPageError } from 'app/features/dashboard/containers/DashboardPageError';
import { type DashboardScene } from 'app/features/dashboard-scene/scene/DashboardScene';
import { DashboardRoutes } from 'app/types/dashboard';

import { NotebookControls } from '../view/NotebookControls';
import { NotebookEditModeProvider } from '../view/NotebookEditModeContext';

import { getNotebookScenePageStateManager } from './NotebookScenePageStateManager';

// Fetch a notebook, wrap it into the scene envelope, hand it to the existing transformer
// via the notebook state manager, and render the resulting scene body read-only.
export function NotebookScenePage() {
  // The route is registered unconditionally (getAppRoutes is not a React component), so the
  // feature flag is enforced here via the OpenFeature hook. When it is off the notebook page
  // is not a real route, so we render the standard not-found page.
  const notebooksEnabled = useFlagDashboardNotebooks();

  const { uid } = useParams();
  const stateManager = getNotebookScenePageStateManager();
  // The state field is `dashboard` (shared DashboardScenePageState); aliased here since
  // on this page the DashboardScene always represents a notebook.
  const { dashboard: notebookScene, isLoading, loadError } = stateManager.useState();

  useEffect(() => {
    if (notebooksEnabled && uid) {
      stateManager.loadDashboard({ uid, route: DashboardRoutes.Notebook });
    }

    return () => {
      stateManager.clearState();
    };
  }, [stateManager, uid, notebooksEnabled]);

  if (!notebooksEnabled) {
    return <PageNotFound />;
  }

  if (!notebookScene) {
    return loadError ? (
      <DashboardPageError error={loadError} />
    ) : (
      <Page navId="notebooks" layout={PageLayoutType.Canvas} data-testid="notebook-scene-page">
        <Box paddingY={4} display="flex" direction="column" alignItems="center">
          {isLoading && <PageLoader />}
        </Box>
      </Page>
    );
  }

  // A notebook with the time picker hidden has no time state to reflect in the URL, so skip URL
  // sync entirely (same as the public dashboard page).
  if (notebookScene.state.controls?.state.hideTimeControls) {
    return <NotebookDocument scene={notebookScene} />;
  }

  return (
    <UrlSyncContextProvider scene={notebookScene} updateUrlOnInit={true} createBrowserHistorySteps={true}>
      <NotebookDocument scene={notebookScene} />
    </UrlSyncContextProvider>
  );
}

// The POC notebook is a read-only document, so we render the scene body inside a plain
// Page instead of DashboardScene.Component — that keeps the dashboard toolbar, sidebar
// and outline sidebar out. The scene is activated so panels still run their queries and
// resolve the shared time range; the title stays via the page breadcrumb (pageNav).
function NotebookDocument({ scene }: { scene: DashboardScene }) {
  const { body, controls, title } = scene.useState();

  useEffect(() => scene.activate(), [scene]);

  // The Notebooks nav section supplies the parent breadcrumb, so pageNav only carries the title.
  const pageNav = { text: title };

  return (
    <Page navId="notebooks" pageNav={pageNav} layout={PageLayoutType.Custom}>
      <NotebookEditModeProvider>
        {/* ScopesVariable (and other UNSAFE_renderAsHidden vars) must mount so query runners aren't blocked forever on dependsOnScopes — same as SoloPanelPage. */}
        {renderHiddenVariables(scene)}
        {/* Rendered unconditionally: the row carries the view/edit toggle, which a notebook
            without time controls still needs. */}
        <NotebookControls controls={controls} />
        {body && <body.Component model={body} />}
      </NotebookEditModeProvider>
    </Page>
  );
}
// Some variables like ScopesVariable need to be rendered for their logic to work even if hidden.
function renderHiddenVariables(scene: DashboardScene) {
  if (!scene.state.$variables) {
    return null;
  }
  return (
    <>
      {scene.state.$variables.state.variables.map((variable) => {
        if (variable.UNSAFE_renderAsHidden) {
          return <variable.Component model={variable} key={variable.state.key} />;
        }
        return null;
      })}
    </>
  );
}

export default NotebookScenePage;
