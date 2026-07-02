import { css } from '@emotion/css';
import { useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom-v5-compat';

import { type GrafanaTheme2, PageLayoutType } from '@grafana/data';
import { t } from '@grafana/i18n';
import { UrlSyncContextProvider } from '@grafana/scenes';
import { Box, useStyles2 } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import PageLoader from 'app/core/components/PageLoader/PageLoader';
import { DashboardPageError } from 'app/features/dashboard/containers/DashboardPageError';
import { type DashboardControls } from 'app/features/dashboard-scene/scene/DashboardControls';
import { type DashboardScene } from 'app/features/dashboard-scene/scene/DashboardScene';
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
      <NotebookDocument scene={notebookScene} />
    </UrlSyncContextProvider>
  );
}

// The POC notebook is a read-only document, so we render the scene body inside a plain
// Page instead of DashboardScene.Component — that keeps the dashboard toolbar, edit pane
// and outline sidebar out. The scene is activated so panels still run their queries and
// resolve the shared time range; the title stays via the page breadcrumb (pageNav).
function NotebookDocument({ scene }: { scene: DashboardScene }) {
  const { body, controls, title } = scene.useState();

  useEffect(() => scene.activate(), [scene]);

  // Show a "Notebooks" breadcrumb parent rather than nesting under the raw title.
  const pageNav = { text: title, parentItem: { text: t('notebook.breadcrumb-title', 'Notebooks') } };

  return (
    <Page navId="dashboards/browse" pageNav={pageNav} layout={PageLayoutType.Custom}>
      {controls && <NotebookControls controls={controls} />}
      {body && <body.Component model={body} />}
    </Page>
  );
}

// Read-only notebooks still get the shared time range + refresh — but only those two
// pickers, not the full dashboard controls bar (which carries edit/variable actions).
function NotebookControls({ controls }: { controls: DashboardControls }) {
  const styles = useStyles2(getControlsStyles);
  const { timePicker, refreshPicker } = controls.useState();

  return (
    <div className={styles.controls}>
      <timePicker.Component model={timePicker} />
      <refreshPicker.Component model={refreshPicker} />
    </div>
  );
}

const getControlsStyles = (theme: GrafanaTheme2) => ({
  controls: css({
    display: 'flex',
    justifyContent: 'flex-end',
    gap: theme.spacing(1),
    padding: theme.spacing(1, 2),
  }),
});

export default NotebookScenePage;
