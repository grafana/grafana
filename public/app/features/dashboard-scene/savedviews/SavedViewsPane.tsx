import { css, cx } from '@emotion/css';
import { useEffect, useReducer, useState } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { locationService } from '@grafana/runtime';
import {
  type SceneComponentProps,
  SceneObjectBase,
  type SceneObjectState,
  SceneVariableValueChangedEvent,
  sceneGraph,
} from '@grafana/scenes';
import {
  Box,
  Button,
  ConfirmModal,
  Dropdown,
  EmptyState,
  FilterInput,
  IconButton,
  Input,
  LoadingPlaceholder,
  Menu,
  ScrollContainer,
  Sidebar,
  Stack,
  Text,
  useStyles2,
} from '@grafana/ui';

import { getDashboardSceneFor } from '../utils/utils';

import { savedDashboardViewsApi, type SavedDashboardView } from './api';
import { loadSavedViews } from './loadSavedViews';
import { applySavedViewState, captureSavedViewState, getSavedViewDiff } from './state';

interface SavedViewsPaneState extends SceneObjectState {
  searchQuery: string;
}

export class SavedViewsPane extends SceneObjectBase<SavedViewsPaneState> {
  public static Component = SavedViewsPaneRenderer;

  constructor(state?: Partial<SavedViewsPaneState>) {
    super({ ...state, searchQuery: state?.searchQuery ?? '' });
  }

  public getId() {
    return 'saved-views' as const;
  }

  public setSearchQuery(searchQuery: string): void {
    if (this.state.searchQuery !== searchQuery) {
      this.setState({ searchQuery });
    }
  }
}

function SavedViewsPaneRenderer({ model }: SceneComponentProps<SavedViewsPane>) {
  const styles = useStyles2(getStyles);
  const dashboard = getDashboardSceneFor(model);
  const { savedViews, viewFilter, uid, savedViewBaseline } = dashboard.useState();
  const { searchQuery } = model.useState();
  const [pendingDelete, setPendingDelete] = useState<SavedDashboardView | undefined>();
  const [isDrafting, setIsDrafting] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [editingView, setEditingView] = useState<SavedDashboardView | undefined>();
  const [editName, setEditName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [loadFailed, setLoadFailed] = useState(false);
  // Re-render on time range and variable changes so the selected view's save button tracks the dashboard.
  sceneGraph.getTimeRange(dashboard).useState();
  const [, refreshOnVariableChange] = useReducer((revision: number) => revision + 1, 0);
  useEffect(() => {
    const sub = dashboard.subscribeToEvent(SceneVariableValueChangedEvent, refreshOnVariableChange);
    return () => sub.unsubscribe();
  }, [dashboard]);

  // undefined means "not fetched yet" (e.g. the pane was opened without a ?viewFilter= link
  // having already loaded them) -- distinct from an empty array, which means "fetched, none saved".
  useEffect(() => {
    if (savedViews === undefined) {
      loadSavedViews(dashboard).then((ok) => setLoadFailed(!ok));
    }
  }, [dashboard, savedViews]);

  function retryLoad() {
    setLoadFailed(false);
    loadSavedViews(dashboard).then((ok) => setLoadFailed(!ok));
  }

  if (savedViews === undefined) {
    return (
      <div>
        <Sidebar.PaneHeader title={t('dashboard.sidebar.saved-views.pane-header', 'Saved views')} />
        <Box padding={1}>
          {loadFailed ? (
            <Stack direction="column" gap={1}>
              <Text color="error">{t('dashboard.sidebar.saved-views.load-error', 'Failed to load saved views.')}</Text>
              <Button variant="secondary" onClick={retryLoad}>
                {t('dashboard.sidebar.saved-views.load-retry', 'Retry')}
              </Button>
            </Stack>
          ) : (
            <LoadingPlaceholder text={t('dashboard.sidebar.saved-views.loading', 'Loading saved views…')} />
          )}
        </Box>
      </div>
    );
  }

  // A view is only "active" once the URL says so; its save button is enabled once the dashboard drifts from it.
  const selectedView = savedViews.find((v) => v.metadata.name === viewFilter);
  const isDirty = selectedView
    ? getSavedViewDiff(captureSavedViewState(dashboard), selectedView.spec, savedViewBaseline)
    : false;

  const trimmedSearchQuery = searchQuery.trim().toLowerCase();
  const filteredViews = trimmedSearchQuery
    ? savedViews.filter((view) => (view.spec.name || view.metadata.name).toLowerCase().includes(trimmedSearchQuery))
    : savedViews;

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
    // Set viewFilter synchronously, in the same tick as the direct apply below. That's what makes
    // DashboardSceneUrlSync's own `values.viewFilter !== viewFilter` guard already false by the
    // time locationService.partial's url change reaches it (wherever a UrlSyncManager is actually
    // live) -- without this, that path schedules a SECOND, redundant apply of the same spec, a
    // real double query-refresh cascade, not a harmless no-op. Applying directly here is still
    // required regardless: re-clicking an already-selected view leaves the url unchanged, so that
    // path never fires at all, and this component needs to work with no live UrlSyncManager too
    // (e.g. its own tests).
    dashboard.setState({ viewFilter: view.metadata.name });
    applySavedViewState(dashboard, view.spec, dashboard.state.savedViewBaseline);
    locationService.partial({ viewFilter: view.metadata.name });
  }

  function handleClearSelection() {
    locationService.partial({ viewFilter: null });
  }

  // Drafting and title editing share the list, so only one inline input is open at a time.
  function startDraft() {
    cancelEditingTitle();
    setDraftName('');
    setIsDrafting(true);
  }

  function cancelDraft() {
    setIsDrafting(false);
    setDraftName('');
  }

  function handleDraftConfirm() {
    return withBusy(async () => {
      const name = draftName.trim();
      if (!uid || !name) {
        return;
      }
      const spec = {
        ...captureSavedViewState(dashboard),
        dashboardUID: uid,
        name,
      };
      const created = await savedDashboardViewsApi.create(spec);
      dashboard.setState({ savedViews: [...(dashboard.state.savedViews ?? []), created] });
      locationService.partial({ viewFilter: created.metadata.name });
      cancelDraft();
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

  function startEditingTitle(view: SavedDashboardView) {
    cancelDraft();
    setEditingView(view);
    setEditName(view.spec.name);
  }

  function cancelEditingTitle() {
    setEditingView(undefined);
    setEditName('');
  }

  const trimmedEditName = editName.trim();
  const isTitleDirty = Boolean(editingView && trimmedEditName && trimmedEditName !== editingView.spec.name);

  function handleEditConfirm() {
    return withBusy(async () => {
      if (!editingView) {
        return;
      }
      const name = editName.trim();
      if (!name) {
        return;
      }
      const updated = await savedDashboardViewsApi.update(editingView, { ...editingView.spec, name });
      dashboard.setState({
        savedViews: (dashboard.state.savedViews ?? []).map((v) =>
          v.metadata.name === updated.metadata.name ? updated : v
        ),
      });
      cancelEditingTitle();
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
    <Box display="flex" direction="column" flex={1} height="100%">
      <Sidebar.PaneHeader title={t('dashboard.sidebar.saved-views.pane-header', 'Saved views')} />
      {savedViews.length > 0 && (
        <div className={styles.searchContainer}>
          <FilterInput
            placeholder={t('dashboard.sidebar.saved-views.search-placeholder', 'Search views')}
            value={searchQuery}
            onChange={(query) => model.setSearchQuery(query)}
            escapeRegex={false}
          />
        </div>
      )}
      <ScrollContainer showScrollIndicators>
        <Box padding={1}>
          <Stack direction="column" gap={1}>
            {error && <Text color="error">{error}</Text>}

            {savedViews.length === 0 && !isDrafting ? (
              <EmptyState
                variant="call-to-action"
                message={t('dashboard.sidebar.saved-views.empty', 'No saved views yet')}
              />
            ) : filteredViews.length === 0 && !isDrafting ? (
              <Text color="secondary">
                <Trans i18nKey="dashboard.sidebar.saved-views.search.no-results">No results found for your query</Trans>
              </Text>
            ) : (
              <Stack direction="column" gap={0}>
                {filteredViews.map((view) => {
                  const isSelected = view.metadata.name === viewFilter;
                  const isEditingTitle = editingView?.metadata.name === view.metadata.name;

                  return (
                    <div key={view.metadata.name} className={cx(styles.row, isSelected && styles.rowSelected)}>
                      <Stack alignItems="center" justifyContent="space-between" gap={1}>
                        {isEditingTitle ? (
                          <>
                            <Box flex={1} minWidth={0}>
                              <Input
                                autoFocus
                                aria-label={t('dashboard.sidebar.saved-views.edit-title-aria-label', 'View title')}
                                value={editName}
                                onChange={(e) => setEditName(e.currentTarget.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' && isTitleDirty) {
                                    handleEditConfirm();
                                  } else if (e.key === 'Escape') {
                                    cancelEditingTitle();
                                  }
                                }}
                                disabled={busy}
                              />
                            </Box>
                            <IconButton
                              name="check"
                              tooltip={t('dashboard.sidebar.saved-views.edit-title-confirm', 'Save title')}
                              onClick={handleEditConfirm}
                              disabled={!isTitleDirty || busy}
                            />
                            <IconButton
                              name="times"
                              tooltip={t('dashboard.sidebar.saved-views.edit-title-cancel', 'Cancel')}
                              onClick={cancelEditingTitle}
                              disabled={busy}
                            />
                          </>
                        ) : (
                          <Button
                            variant={isSelected ? 'primary' : 'secondary'}
                            fill="text"
                            className={styles.nameButton}
                            onClick={() => handleSelect(view)}
                          >
                            {view.spec.name || view.metadata.name}
                          </Button>
                        )}

                        {isSelected && !isEditingTitle && (
                          <IconButton
                            name="save"
                            tooltip={t('dashboard.sidebar.saved-views.save-changes', 'Save changes')}
                            onClick={handleOverwrite}
                            disabled={!isDirty || busy}
                          />
                        )}

                        {!isEditingTitle && (
                          <Dropdown
                            overlay={
                              <Menu>
                                <Menu.Item
                                  label={t('dashboard.sidebar.saved-views.edit-title', 'Edit title')}
                                  icon="pen"
                                  onClick={() => startEditingTitle(view)}
                                />
                                <Menu.Item
                                  label={t('dashboard.sidebar.saved-views.delete', 'Delete')}
                                  icon="trash-alt"
                                  destructive
                                  onClick={() => setPendingDelete(view)}
                                />
                              </Menu>
                            }
                            placement="bottom-end"
                          >
                            <IconButton
                              name="ellipsis-v"
                              aria-label={t('dashboard.sidebar.saved-views.actions-aria-label', 'Actions')}
                              disabled={busy}
                            />
                          </Dropdown>
                        )}
                      </Stack>
                    </div>
                  );
                })}

                {isDrafting && (
                  <div className={styles.row}>
                    <Box flex={1} minWidth={0}>
                      <Input
                        autoFocus
                        aria-label={t('dashboard.sidebar.saved-views.new-title-aria-label', 'New view title')}
                        placeholder={t('dashboard.sidebar.saved-views.new-name-placeholder', 'New view name')}
                        value={draftName}
                        onChange={(e) => setDraftName(e.currentTarget.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handleDraftConfirm();
                          } else if (e.key === 'Escape') {
                            cancelDraft();
                          }
                        }}
                        disabled={busy}
                      />
                    </Box>
                  </div>
                )}
              </Stack>
            )}
          </Stack>
        </Box>
      </ScrollContainer>

      <div className={styles.footer}>
        <Stack justifyContent="flex-end" gap={1}>
          {isDrafting ? (
            <>
              <Button variant="secondary" onClick={cancelDraft} disabled={busy}>
                {t('dashboard.sidebar.saved-views.save-new-cancel', 'Cancel')}
              </Button>
              <Button variant="primary" onClick={handleDraftConfirm} disabled={!draftName.trim() || busy}>
                {t('dashboard.sidebar.saved-views.save-new-confirm', 'Confirm')}
              </Button>
            </>
          ) : (
            <Button icon="plus" variant="primary" onClick={startDraft} disabled={busy}>
              {t('dashboard.sidebar.saved-views.save-new', 'Save new')}
            </Button>
          )}
        </Stack>
      </div>

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
    </Box>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    searchContainer: css({
      padding: theme.spacing(1, 1, 0, 1),
    }),
    footer: css({
      flexShrink: 0,
      // Sidebar's own openPane wrapper already reserves paddingBottom: theme.spacing(2) below its
      // content, so no bottom padding here to avoid doubling it up.
      padding: theme.spacing(2, 1, 0, 1),
      borderTop: `1px solid ${theme.colors.border.weak}`,
    }),
    row: css({
      padding: theme.spacing(1),
      borderRadius: theme.shape.radius.default,
      '&:hover': {
        backgroundColor: theme.colors.action.hover,
      },
    }),
    rowSelected: css({
      backgroundColor: theme.colors.action.selected,
    }),
    nameButton: css({
      flex: 1,
      minWidth: 0,
      justifyContent: 'flex-start',
      // Zeroed out so the title text lines up with the search input's left edge.
      padding: 0,
      // The row itself already highlights on hover -- suppress the Button's own
      // hover/focus background so it doesn't show as a second, differently-colored rectangle.
      '&:hover, &:focus': {
        background: 'transparent',
      },
      '& > span': {
        minWidth: 0,
        textOverflow: 'ellipsis',
      },
    }),
  };
}
