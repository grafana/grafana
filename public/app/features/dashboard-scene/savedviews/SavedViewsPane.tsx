import { css, cx } from '@emotion/css';
import { useEffect, useState } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { locationService } from '@grafana/runtime';
import { type SceneComponentProps, SceneObjectBase, type SceneObjectState } from '@grafana/scenes';
import {
  Box,
  Button,
  ConfirmModal,
  Dropdown,
  EmptyState,
  Field,
  FilterInput,
  IconButton,
  Input,
  Label,
  LoadingPlaceholder,
  Menu,
  Modal,
  ScrollContainer,
  Sidebar,
  Stack,
  Text,
  useStyles2,
} from '@grafana/ui';

import { getDashboardSceneFor } from '../utils/utils';

import { savedDashboardViewsApi, type SavedDashboardView } from './api';
import { loadSavedViews } from './loadSavedViews';
import { captureSavedViewState } from './state';

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

interface RenameState {
  name: string;
  draft: string;
}

function SavedViewsPaneRenderer({ model }: SceneComponentProps<SavedViewsPane>) {
  const styles = useStyles2(getStyles);
  const dashboard = getDashboardSceneFor(model);
  const { savedViews, viewFilter, uid } = dashboard.useState();
  const { searchQuery } = model.useState();
  const [renaming, setRenaming] = useState<RenameState | undefined>();
  const [pendingDelete, setPendingDelete] = useState<SavedDashboardView | undefined>();
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [saveModalName, setSaveModalName] = useState('');
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

  // A view is only "active" once the URL says so -- this is what gates Overwrite, not local edits.
  const selectedView = savedViews.find((v) => v.metadata.name === viewFilter);

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
    locationService.partial({ viewFilter: view.metadata.name });
  }

  function handleClearSelection() {
    locationService.partial({ viewFilter: null });
  }

  function openSaveModal() {
    setSaveModalName('');
    setIsSaveModalOpen(true);
  }

  function closeSaveModal() {
    setIsSaveModalOpen(false);
    setSaveModalName('');
  }

  function handleSaveModalConfirm() {
    return withBusy(async () => {
      const name = saveModalName.trim();
      if (!uid || !name) {
        return;
      }
      const spec = { ...captureSavedViewState(dashboard), dashboardUID: uid, name };
      const created = await savedDashboardViewsApi.create(spec);
      dashboard.setState({ savedViews: [...(dashboard.state.savedViews ?? []), created] });
      locationService.partial({ viewFilter: created.metadata.name });
      closeSaveModal();
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
    <Box display="flex" direction="column" flex={1} height="100%">
      <Sidebar.PaneHeader title={t('dashboard.sidebar.saved-views.pane-header', 'Saved views')} />
      {savedViews.length > 0 && (
        <div className={styles.searchContainer}>
          <FilterInput
            placeholder={t('dashboard.sidebar.saved-views.search-placeholder', 'Search views')}
            value={searchQuery}
            onChange={(query) => model.setSearchQuery(query)}
            escapeRegex={false}
            className={styles.searchInput}
          />
        </div>
      )}
      <ScrollContainer showScrollIndicators>
        <Box padding={1}>
          <Stack direction="column" gap={1}>
            {error && <Text color="error">{error}</Text>}

            {savedViews.length === 0 ? (
              <EmptyState
                variant="call-to-action"
                message={t('dashboard.sidebar.saved-views.empty', 'No saved views yet')}
              />
            ) : filteredViews.length === 0 ? (
              <Text color="secondary">
                <Trans i18nKey="dashboard.sidebar.saved-views.search.no-results">No results found for your query</Trans>
              </Text>
            ) : (
              <Stack direction="column" gap={0}>
                {filteredViews.map((view) => {
                  const isSelected = view.metadata.name === viewFilter;
                  const isRenaming = renaming?.name === view.metadata.name;

                  return (
                    <div key={view.metadata.name} className={cx(styles.row, isSelected && styles.rowSelected)}>
                      <Stack alignItems="center" justifyContent="space-between" gap={1}>
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
                            className={styles.nameButton}
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
                            <Dropdown
                              overlay={
                                <Menu>
                                  <Menu.Item
                                    label={t('dashboard.sidebar.saved-views.rename', 'Rename')}
                                    icon="pen"
                                    onClick={() => setRenaming({ name: view.metadata.name, draft: view.spec.name })}
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
                      </Stack>
                    </div>
                  );
                })}
              </Stack>
            )}
          </Stack>
        </Box>
      </ScrollContainer>

      <div className={styles.footer}>
        <Stack gap={1}>
          <Button variant="secondary" onClick={openSaveModal} disabled={busy} className={styles.footerButton}>
            {t('dashboard.sidebar.saved-views.save-new', 'Save new')}
          </Button>
          <Button
            variant="secondary"
            disabled={!selectedView || busy}
            onClick={handleOverwrite}
            className={styles.footerButton}
            tooltip={
              selectedView
                ? t('dashboard.sidebar.saved-views.overwrite-tooltip', 'Overwrite "%NAME%"').replace(
                    '%NAME%',
                    selectedView.spec.name
                  )
                : t('dashboard.sidebar.saved-views.overwrite-tooltip-none', 'Select a saved view to overwrite')
            }
          >
            {t('dashboard.sidebar.saved-views.overwrite', 'Overwrite')}
          </Button>
        </Stack>
      </div>

      {isSaveModalOpen && (
        <Modal
          isOpen
          title={t('dashboard.sidebar.saved-views.save-new-modal-title', 'Save new view')}
          onDismiss={closeSaveModal}
          onClickBackdrop={closeSaveModal}
        >
          <Stack direction="column" gap={2}>
            <Field
              noMargin
              label={
                <Label htmlFor="saved-view-name">
                  {t('dashboard.sidebar.saved-views.new-name-label', 'View name')}
                </Label>
              }
            >
              <Input
                id="saved-view-name"
                autoFocus
                placeholder={t('dashboard.sidebar.saved-views.new-name-placeholder', 'New view name')}
                value={saveModalName}
                onChange={(e) => setSaveModalName(e.currentTarget.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && saveModalName.trim()) {
                    handleSaveModalConfirm();
                  }
                }}
              />
            </Field>
            <Modal.ButtonRow>
              <Button variant="secondary" onClick={closeSaveModal}>
                <Trans i18nKey="dashboard.sidebar.saved-views.save-new-modal-cancel">Cancel</Trans>
              </Button>
              <Button onClick={handleSaveModalConfirm} disabled={!saveModalName.trim() || busy}>
                <Trans i18nKey="dashboard.sidebar.saved-views.save-new-modal-confirm">Save</Trans>
              </Button>
            </Modal.ButtonRow>
          </Stack>
        </Modal>
      )}

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
    searchInput: css({
      width: '100%',
    }),
    footer: css({
      flexShrink: 0,
      // Sidebar's own openPane wrapper already reserves paddingBottom: theme.spacing(2) below its
      // content, so no bottom padding here to avoid doubling it up.
      padding: theme.spacing(1, 1, 0, 1),
      borderTop: `1px solid ${theme.colors.border.weak}`,
    }),
    footerButton: css({
      flex: 1,
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
