import { useEffect, useState } from 'react';

import { t, Trans } from '@grafana/i18n';
import { locationService } from '@grafana/runtime';
import { type SceneComponentProps, SceneObjectBase } from '@grafana/scenes';
import {
  Box,
  Button,
  ConfirmModal,
  EmptyState,
  IconButton,
  Input,
  LoadingPlaceholder,
  Sidebar,
  Stack,
  Text,
} from '@grafana/ui';

import { getDashboardSceneFor } from '../utils/utils';

import { savedDashboardViewsApi, type SavedDashboardView } from './api';
import { loadSavedViews } from './loadSavedViews';
import { captureSavedViewState, getSavedViewDiff } from './state';

export class SavedViewsPane extends SceneObjectBase {
  public static Component = SavedViewsPaneRenderer;

  public getId() {
    return 'saved-views' as const;
  }
}

interface RenameState {
  name: string;
  draft: string;
}

function SavedViewsPaneRenderer({ model }: SceneComponentProps<SavedViewsPane>) {
  const dashboard = getDashboardSceneFor(model);
  const { savedViews, viewFilter, uid } = dashboard.useState();
  const [newViewName, setNewViewName] = useState('');
  const [renaming, setRenaming] = useState<RenameState | undefined>();
  const [pendingDelete, setPendingDelete] = useState<SavedDashboardView | undefined>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();

  // undefined means "not fetched yet" (e.g. the pane was opened without a ?viewFilter= link
  // having already loaded them) -- distinct from an empty array, which means "fetched, none saved".
  useEffect(() => {
    if (savedViews === undefined) {
      loadSavedViews(dashboard);
    }
  }, [dashboard, savedViews]);

  if (savedViews === undefined) {
    return (
      <div>
        <Sidebar.PaneHeader title={t('dashboard.sidebar.saved-views.pane-header', 'Saved views')} />
        <Box padding={1}>
          <LoadingPlaceholder text={t('dashboard.sidebar.saved-views.loading', 'Loading saved views…')} />
        </Box>
      </div>
    );
  }

  const selectedView = savedViews.find((v) => v.metadata.name === viewFilter);
  // Recomputed on every render rather than memoized -- this is a sidebar pane, not a hot path,
  // and the capture itself is a cheap synchronous read of scene state.
  const isDirty = selectedView ? getSavedViewDiff(captureSavedViewState(dashboard), selectedView.spec) : false;

  async function withBusy(fn: () => Promise<void>) {
    setBusy(true);
    setError(undefined);
    try {
      await fn();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  function handleSelect(view: SavedDashboardView) {
    locationService.partial({ viewFilter: view.metadata.name });
  }

  function handleClearSelection() {
    locationService.partial({ viewFilter: null });
  }

  function handleSaveAsNew() {
    return withBusy(async () => {
      const name = newViewName.trim();
      if (!uid || !name) {
        return;
      }
      const spec = { ...captureSavedViewState(dashboard), dashboardUID: uid, name };
      const created = await savedDashboardViewsApi.create(spec);
      dashboard.setState({ savedViews: [...(dashboard.state.savedViews ?? []), created] });
      setNewViewName('');
      locationService.partial({ viewFilter: created.metadata.name });
    });
  }

  function handleOverwrite() {
    return withBusy(async () => {
      if (!selectedView) {
        return;
      }
      const spec = {
        ...captureSavedViewState(dashboard),
        dashboardUID: selectedView.spec.dashboardUID,
        name: selectedView.spec.name,
      };
      const updated = await savedDashboardViewsApi.update(selectedView, spec);
      dashboard.setState({
        savedViews: (dashboard.state.savedViews ?? []).map((v) =>
          v.metadata.name === updated.metadata.name ? updated : v
        ),
      });
    });
  }

  function handleRenameSubmit(view: SavedDashboardView) {
    return withBusy(async () => {
      const name = renaming?.draft.trim();
      if (!name) {
        return;
      }
      const updated = await savedDashboardViewsApi.update(view, { ...view.spec, name });
      dashboard.setState({
        savedViews: (dashboard.state.savedViews ?? []).map((v) =>
          v.metadata.name === updated.metadata.name ? updated : v
        ),
      });
      setRenaming(undefined);
    });
  }

  function handleDelete(view: SavedDashboardView) {
    return withBusy(async () => {
      await savedDashboardViewsApi.remove(view.metadata.name);
      dashboard.setState({
        savedViews: (dashboard.state.savedViews ?? []).filter((v) => v.metadata.name !== view.metadata.name),
      });
      if (viewFilter === view.metadata.name) {
        handleClearSelection();
      }
      setPendingDelete(undefined);
    });
  }

  return (
    <div>
      <Sidebar.PaneHeader title={t('dashboard.sidebar.saved-views.pane-header', 'Saved views')} />
      <Box padding={1}>
        <Stack direction="column" gap={2}>
          {error && <Text color="error">{error}</Text>}

          {savedViews.length === 0 ? (
            <EmptyState
              variant="call-to-action"
              message={t('dashboard.sidebar.saved-views.empty', 'No saved views yet')}
            />
          ) : (
            <Stack direction="column" gap={1}>
              {savedViews.map((view) => {
                const isSelected = view.metadata.name === viewFilter;
                const isRenaming = renaming?.name === view.metadata.name;

                return (
                  <Box
                    key={view.metadata.name}
                    padding={1}
                    borderColor={isSelected ? 'strong' : 'weak'}
                    borderStyle="solid"
                  >
                    <Stack alignItems="center" justifyContent="space-between">
                      {isRenaming ? (
                        <Input
                          autoFocus
                          value={renaming?.draft ?? ''}
                          onChange={(e) => setRenaming({ name: view.metadata.name, draft: e.currentTarget.value })}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              handleRenameSubmit(view);
                            }
                          }}
                        />
                      ) : (
                        <Button
                          variant={isSelected ? 'primary' : 'secondary'}
                          fill="text"
                          onClick={() => handleSelect(view)}
                        >
                          {view.spec.name || view.metadata.name}
                        </Button>
                      )}

                      <Stack gap={0.5}>
                        {isRenaming ? (
                          <>
                            <IconButton
                              name="check"
                              tooltip={t('dashboard.sidebar.saved-views.rename-save', 'Save name')}
                              onClick={() => handleRenameSubmit(view)}
                              disabled={busy}
                            />
                            <IconButton
                              name="times"
                              tooltip={t('dashboard.sidebar.saved-views.rename-cancel', 'Cancel')}
                              onClick={() => setRenaming(undefined)}
                            />
                          </>
                        ) : (
                          <>
                            <IconButton
                              name="pen"
                              tooltip={t('dashboard.sidebar.saved-views.rename', 'Rename')}
                              onClick={() => setRenaming({ name: view.metadata.name, draft: view.spec.name })}
                              disabled={busy}
                            />
                            <IconButton
                              name="trash-alt"
                              tooltip={t('dashboard.sidebar.saved-views.delete', 'Delete')}
                              onClick={() => setPendingDelete(view)}
                              disabled={busy}
                            />
                          </>
                        )}
                      </Stack>
                    </Stack>
                  </Box>
                );
              })}
            </Stack>
          )}

          <Stack direction="column" gap={1}>
            <Button variant="secondary" disabled={!selectedView || !isDirty || busy} onClick={handleOverwrite}>
              {selectedView
                ? t('dashboard.sidebar.saved-views.overwrite', 'Overwrite "%NAME%"').replace(
                    '%NAME%',
                    selectedView.spec.name
                  )
                : t('dashboard.sidebar.saved-views.overwrite-none', 'Overwrite selected view')}
            </Button>

            <Stack>
              <Input
                placeholder={t('dashboard.sidebar.saved-views.new-name-placeholder', 'New view name')}
                value={newViewName}
                onChange={(e) => setNewViewName(e.currentTarget.value)}
              />
              <Button onClick={handleSaveAsNew} disabled={!newViewName.trim() || busy}>
                <Trans i18nKey="dashboard.sidebar.saved-views.save-as-new">Save as new view</Trans>
              </Button>
            </Stack>
          </Stack>
        </Stack>
      </Box>

      {pendingDelete && (
        <ConfirmModal
          isOpen
          title={t('dashboard.sidebar.saved-views.delete-confirm-title', 'Delete saved view')}
          body={t(
            'dashboard.sidebar.saved-views.delete-confirm-body',
            'Delete "%NAME%"? This cannot be undone.'
          ).replace('%NAME%', pendingDelete.spec.name)}
          confirmText={t('dashboard.sidebar.saved-views.delete-confirm-confirm', 'Delete')}
          onConfirm={() => handleDelete(pendingDelete)}
          onDismiss={() => setPendingDelete(undefined)}
        />
      )}
    </div>
  );
}
