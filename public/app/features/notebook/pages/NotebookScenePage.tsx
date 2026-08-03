import { css } from '@emotion/css';
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom-v5-compat';

import { AppEvents, type GrafanaTheme2, PageLayoutType } from '@grafana/data';
import { t } from '@grafana/i18n';
import { locationService } from '@grafana/runtime';
import { useFlagDashboardNotebooks } from '@grafana/runtime/internal';
import { UrlSyncContextProvider } from '@grafana/scenes';
import { Box, Button, ConfirmModal, Dropdown, IconButton, LinkButton, Menu, useStyles2 } from '@grafana/ui';
import { appEvents } from 'app/core/app_events';
import { Page } from 'app/core/components/Page/Page';
import PageLoader from 'app/core/components/PageLoader/PageLoader';
import { PageNotFound } from 'app/core/components/PageNotFound/PageNotFound';
import { contextSrv } from 'app/core/services/context_srv';
import { copyStringToClipboard } from 'app/core/utils/explore';
import { DashboardPageError } from 'app/features/dashboard/containers/DashboardPageError';
import { type DashboardControls } from 'app/features/dashboard-scene/scene/DashboardControls';
import { type DashboardScene } from 'app/features/dashboard-scene/scene/DashboardScene';
import { NotebookLayoutManager } from 'app/features/dashboard-scene/scene/layout-notebook/NotebookLayoutManager';
import { AccessControlAction } from 'app/types/accessControl';
import { DashboardRoutes } from 'app/types/dashboard';

import { deleteNotebook, duplicateNotebook, fetchNotebook, notebookEditUrl } from '../api/notebookAPI';
import { DeclareIncidentFromNotebookButton } from '../extensions/DeclareIncidentFromNotebookButton';

import { getNotebookScenePageStateManager } from './NotebookScenePageStateManager';
import { NotebookSceneTimePicker } from './NotebookSceneTimePicker';

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
      <Page navId="dashboards/browse" layout={PageLayoutType.Canvas} data-testid="notebook-scene-page">
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

// The notebook view is a read-only document, so we render the scene body inside a plain
// Page instead of DashboardScene.Component — that keeps the dashboard toolbar, edit pane
// and outline sidebar out. The scene is activated so panels still run their queries and
// resolve the shared time range; the title stays via the page breadcrumb (pageNav).
function NotebookDocument({ scene }: { scene: DashboardScene }) {
  const { body, controls, title, description, tags, uid } = scene.useState();

  useEffect(() => scene.activate(), [scene]);

  // Show a "Notebooks" breadcrumb parent linking back to the notebooks list.
  const pageNav = { text: title, parentItem: { text: t('notebook.breadcrumb-title', 'Notebooks'), url: '/notebooks' } };

  return (
    <Page navId="notebooks" pageNav={pageNav} layout={PageLayoutType.Custom}>
      {/* ScopesVariable (and other UNSAFE_renderAsHidden vars) must mount so query runners aren't blocked forever on dependsOnScopes — same as SoloPanelPage. */}
      {renderHiddenVariables(scene)}
      {controls && (
        <NotebookControls
          controls={controls}
          uid={uid}
          title={title}
          description={description}
          tags={tags}
          panelTitles={
            body instanceof NotebookLayoutManager
              ? body
                  .getVizPanels()
                  .map((panel) => panel.state.title)
                  .filter((panelTitle): panelTitle is string => Boolean(panelTitle?.trim()))
              : undefined
          }
        />
      )}
      {body && <body.Component model={body} />}
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

// Read-only notebooks still get the shared time range + refresh — but only those two
// pickers, not the full dashboard controls bar (which carries edit/variable actions).
// The Edit button is the entry into the collaborative notebook editor.
function NotebookControls({
  controls,
  uid,
  title,
  description,
  tags,
  panelTitles,
}: {
  controls: DashboardControls;
  uid?: string;
  title?: string;
  description?: string;
  tags?: string[];
  panelTitles?: string[];
}) {
  const styles = useStyles2(getControlsStyles);
  const { timePicker, refreshPicker, hideTimeControls } = controls.useState();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const canEdit =
    contextSrv.hasPermission(AccessControlAction.DashboardsCreate) ||
    contextSrv.hasPermission(AccessControlAction.DashboardsWrite);

  if (hideTimeControls && !canEdit) {
    return null;
  }

  const onDuplicate = async () => {
    if (!uid) {
      return;
    }
    try {
      // Fetch fresh: the scene envelope does not retain the raw notebook spec.
      const notebook = await fetchNotebook(uid);
      const created = await duplicateNotebook(
        notebook.spec,
        t('notebooks.list.copy-title', '{{title}} (copy)', { title: notebook.spec.title })
      );
      locationService.push(notebookEditUrl(created.metadata.name));
    } catch (error) {
      appEvents.emit(AppEvents.alertError, [
        t('notebooks.list.duplicate-failed', 'Failed to duplicate notebook'),
        error instanceof Error ? error.message : '',
      ]);
    }
  };

  const moreMenu = (
    <Menu>
      <Menu.Item
        icon="file-copy-alt"
        label={t('notebook.duplicate', 'Duplicate notebook')}
        onClick={() => {
          onDuplicate();
        }}
      />
      <Menu.Divider />
      <Menu.Item
        icon="trash-alt"
        destructive
        label={t('notebook.delete', 'Delete notebook')}
        onClick={() => setConfirmDelete(true)}
      />
    </Menu>
  );

  return (
    <div className={styles.controls}>
      <LinkButton
        variant="secondary"
        fill="text"
        icon="arrow-left"
        href="/notebooks"
        data-testid="notebook-back-button"
      >
        {t('notebook.back-button', 'All notebooks')}
      </LinkButton>
      <div className={styles.controlsRight}>
        {/* Match Edit / time-picker chrome: secondary filled controls (not bare IconButtons). */}
        <Button
          variant="secondary"
          icon="link"
          tooltip={t('notebook.copy-link', 'Copy link')}
          aria-label={t('notebook.copy-link', 'Copy link')}
          onClick={() => {
            copyStringToClipboard(window.location.href);
            appEvents.emit(AppEvents.alertSuccess, [t('notebook.link-copied', 'Notebook link copied')]);
          }}
          data-testid="notebook-copy-link"
        />
        {uid && (
          <DeclareIncidentFromNotebookButton
            uid={uid}
            title={title ?? ''}
            description={description}
            tags={tags}
            panelTitles={panelTitles}
          />
        )}
        {canEdit && uid && (
          <LinkButton variant="secondary" icon="pen" href={`/notebooks/edit/${uid}`} data-testid="notebook-edit-button">
            {t('notebook.edit-button', 'Edit')}
          </LinkButton>
        )}
        {!hideTimeControls && (
          <>
            <NotebookSceneTimePicker model={timePicker} />
            <refreshPicker.Component model={refreshPicker} />
          </>
        )}
        {canEdit && uid && (
          <Dropdown overlay={moreMenu} placement="bottom-end">
            <IconButton name="ellipsis-v" size="lg" tooltip={t('notebook.more-actions', 'More actions')} />
          </Dropdown>
        )}
      </div>

      <ConfirmModal
        isOpen={confirmDelete}
        title={t('notebook.delete-title', 'Delete notebook')}
        body={t('notebook.delete-body', 'Are you sure you want to delete this notebook?')}
        confirmText={t('notebook.delete-confirm', 'Delete')}
        onConfirm={async () => {
          if (uid) {
            await deleteNotebook(uid);
          }
          locationService.push('/notebooks');
        }}
        onDismiss={() => setConfirmDelete(false)}
      />
    </div>
  );
}

const getControlsStyles = (theme: GrafanaTheme2) => ({
  controls: css({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing(1),
    padding: theme.spacing(1, 2),
  }),
  controlsRight: css({
    display: 'flex',
    gap: theme.spacing(1),
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
  }),
});

export default NotebookScenePage;
