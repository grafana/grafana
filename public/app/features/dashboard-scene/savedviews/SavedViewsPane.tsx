import { css, cx } from '@emotion/css';
import { skipToken } from '@reduxjs/toolkit/query';
import { useEffect, useMemo, useState } from 'react';

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
  TextArea,
  useStyles2,
} from '@grafana/ui';
import { useGetDisplayMappingQuery } from 'app/api/clients/iam/v0alpha1';
import { AnnoKeyCreatedBy } from 'app/features/apiserver/types';

import { getDashboardSceneFor } from '../utils/utils';

import { savedDashboardViewsApi, type SavedDashboardView } from './api';
import { loadSavedViews } from './loadSavedViews';
import { captureSavedViewState } from './state';

type ViewMode = 'compact' | 'expanded';

interface SavedViewsPaneState extends SceneObjectState {
  searchQuery: string;
  viewMode: ViewMode;
}

export class SavedViewsPane extends SceneObjectBase<SavedViewsPaneState> {
  public static Component = SavedViewsPaneRenderer;

  constructor(state?: Partial<SavedViewsPaneState>) {
    super({ ...state, searchQuery: state?.searchQuery ?? '', viewMode: state?.viewMode ?? 'compact' });
  }

  public getId() {
    return 'saved-views' as const;
  }

  public setSearchQuery(searchQuery: string): void {
    if (this.state.searchQuery !== searchQuery) {
      this.setState({ searchQuery });
    }
  }

  public setViewMode(viewMode: ViewMode): void {
    if (this.state.viewMode !== viewMode) {
      this.setState({ viewMode });
    }
  }
}

interface SavedViewFormFieldsProps {
  name: string;
  onNameChange: (name: string) => void;
  namePlaceholder: string;
  description: string;
  onDescriptionChange: (description: string) => void;
}

function SavedViewFormFields({
  name,
  onNameChange,
  namePlaceholder,
  description,
  onDescriptionChange,
}: SavedViewFormFieldsProps) {
  return (
    <>
      <Field
        noMargin
        label={
          <Label htmlFor="saved-view-name">{t('dashboard.sidebar.saved-views.new-name-label', 'View name')}</Label>
        }
      >
        <Input
          id="saved-view-name"
          autoFocus
          placeholder={namePlaceholder}
          value={name}
          onChange={(e) => onNameChange(e.currentTarget.value)}
        />
      </Field>
      <Field
        noMargin
        label={
          <Label htmlFor="saved-view-description">
            {t('dashboard.sidebar.saved-views.description-label', 'Description')}
          </Label>
        }
      >
        <TextArea
          id="saved-view-description"
          rows={3}
          placeholder={t('dashboard.sidebar.saved-views.description-placeholder', 'Add a description (optional)')}
          value={description}
          onChange={(e) => onDescriptionChange(e.currentTarget.value)}
        />
      </Field>
    </>
  );
}

function SavedViewsPaneRenderer({ model }: SceneComponentProps<SavedViewsPane>) {
  const styles = useStyles2(getStyles);
  const dashboard = getDashboardSceneFor(model);
  const { savedViews, viewFilter, uid } = dashboard.useState();
  const { searchQuery, viewMode } = model.useState();
  const [pendingDelete, setPendingDelete] = useState<SavedDashboardView | undefined>();
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [saveModalName, setSaveModalName] = useState('');
  const [saveModalDescription, setSaveModalDescription] = useState('');
  const [editingView, setEditingView] = useState<SavedDashboardView | undefined>();
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();

  // undefined means "not fetched yet" (e.g. the pane was opened without a ?viewFilter= link
  // having already loaded them) -- distinct from an empty array, which means "fetched, none saved".
  useEffect(() => {
    if (savedViews === undefined) {
      loadSavedViews(dashboard);
    }
  }, [dashboard, savedViews]);

  const authorUids = useMemo(
    () =>
      Array.from(
        new Set(
          (savedViews ?? [])
            .map((v) => v.metadata.annotations?.[AnnoKeyCreatedBy])
            .filter((uid): uid is string => Boolean(uid))
        )
      ),
    [savedViews]
  );
  // Only asked for while the list is expanded -- collapsed rows never show an author, so there is
  // nothing to justify the extra IAM lookup traffic.
  const { data: displayMapping } = useGetDisplayMappingQuery(
    viewMode === 'expanded' && authorUids.length > 0 ? { key: authorUids } : skipToken
  );
  const authorNames = useMemo(() => {
    const map = new Map<string, string>();
    for (const entry of displayMapping?.display ?? []) {
      if (entry.identity.name) {
        map.set(`${entry.identity.type}:${entry.identity.name}`, entry.displayName);
      }
      if (entry.internalId) {
        map.set(`${entry.identity.type}:${entry.internalId}`, entry.displayName);
      }
    }
    return map;
  }, [displayMapping]);

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
    setSaveModalDescription('');
    setIsSaveModalOpen(true);
  }

  function closeSaveModal() {
    setIsSaveModalOpen(false);
    setSaveModalName('');
    setSaveModalDescription('');
  }

  function handleSaveModalConfirm() {
    return withBusy(async () => {
      const name = saveModalName.trim();
      if (!uid || !name) {
        return;
      }
      const description = saveModalDescription.trim();
      const spec = {
        ...captureSavedViewState(dashboard),
        dashboardUID: uid,
        name,
        description: description || undefined,
      };
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
        // Overwrite only replaces the described state (time range + variables), not the label/description --
        // carry the existing one forward or update() would silently wipe it (it replaces the whole spec).
        description: selectedView.spec.description,
      };
      const updated = await savedDashboardViewsApi.update(selectedView, spec);
      dashboard.setState({
        savedViews: (dashboard.state.savedViews ?? []).map((v) =>
          v.metadata.name === updated.metadata.name ? updated : v
        ),
      });
    });
  }

  function openEditModal(view: SavedDashboardView) {
    setEditingView(view);
    setEditName(view.spec.name);
    setEditDescription(view.spec.description ?? '');
  }

  function closeEditModal() {
    setEditingView(undefined);
    setEditName('');
    setEditDescription('');
  }

  function handleEditConfirm() {
    return withBusy(async () => {
      if (!editingView) {
        return;
      }
      const name = editName.trim();
      if (!name) {
        return;
      }
      const description = editDescription.trim();
      const updated = await savedDashboardViewsApi.update(editingView, {
        ...editingView.spec,
        name,
        description: description || undefined,
      });
      dashboard.setState({
        savedViews: (dashboard.state.savedViews ?? []).map((v) =>
          v.metadata.name === updated.metadata.name ? updated : v
        ),
      });
      closeEditModal();
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
          <Stack gap={1} alignItems="center">
            <FilterInput
              placeholder={t('dashboard.sidebar.saved-views.search-placeholder', 'Search views')}
              value={searchQuery}
              onChange={(query) => model.setSearchQuery(query)}
              escapeRegex={false}
              className={styles.searchInput}
            />
            <IconButton
              name={viewMode === 'expanded' ? 'table-collapse-all' : 'table-expand-all'}
              tooltip={
                viewMode === 'expanded'
                  ? t('dashboard.sidebar.saved-views.view-mode-compact', 'Show compact list')
                  : t('dashboard.sidebar.saved-views.view-mode-expanded', 'Show details')
              }
              onClick={() => model.setViewMode(viewMode === 'expanded' ? 'compact' : 'expanded')}
            />
          </Stack>
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
                  const authorUid = view.metadata.annotations?.[AnnoKeyCreatedBy];
                  const authorName = authorUid
                    ? (authorNames.get(authorUid) ??
                      t('dashboard.sidebar.saved-views.author-unknown', 'Unknown author'))
                    : undefined;

                  return (
                    <div key={view.metadata.name} className={cx(styles.row, isSelected && styles.rowSelected)}>
                      <Stack alignItems="center" justifyContent="space-between" gap={1}>
                        <Button
                          variant={isSelected ? 'primary' : 'secondary'}
                          fill="text"
                          className={styles.nameButton}
                          onClick={() => handleSelect(view)}
                        >
                          {view.spec.name || view.metadata.name}
                        </Button>

                        <Dropdown
                          overlay={
                            <Menu>
                              <Menu.Item
                                label={t('dashboard.sidebar.saved-views.edit', 'Edit')}
                                icon="pen"
                                onClick={() => openEditModal(view)}
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
                      </Stack>

                      {viewMode === 'expanded' && (view.spec.description || authorName) && (
                        <div className={styles.rowMeta}>
                          {view.spec.description && (
                            <Text variant="bodySmall" color="secondary">
                              {view.spec.description}
                            </Text>
                          )}
                          {authorName && (
                            <Text variant="bodySmall" color="secondary">
                              {t('dashboard.sidebar.saved-views.author', 'Created by %AUTHOR%').replace(
                                '%AUTHOR%',
                                authorName
                              )}
                            </Text>
                          )}
                        </div>
                      )}
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
            <SavedViewFormFields
              name={saveModalName}
              onNameChange={setSaveModalName}
              namePlaceholder={t('dashboard.sidebar.saved-views.new-name-placeholder', 'New view name')}
              description={saveModalDescription}
              onDescriptionChange={setSaveModalDescription}
            />
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

      {editingView && (
        <Modal
          isOpen
          title={t('dashboard.sidebar.saved-views.edit-modal-title', 'Edit view')}
          onDismiss={closeEditModal}
          onClickBackdrop={closeEditModal}
        >
          <Stack direction="column" gap={2}>
            <SavedViewFormFields
              name={editName}
              onNameChange={setEditName}
              namePlaceholder={t('dashboard.sidebar.saved-views.new-name-placeholder', 'New view name')}
              description={editDescription}
              onDescriptionChange={setEditDescription}
            />
            <Modal.ButtonRow>
              <Button variant="secondary" onClick={closeEditModal}>
                <Trans i18nKey="dashboard.sidebar.saved-views.edit-modal-cancel">Cancel</Trans>
              </Button>
              <Button onClick={handleEditConfirm} disabled={!editName.trim() || busy}>
                <Trans i18nKey="dashboard.sidebar.saved-views.edit-modal-confirm">Save</Trans>
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
      flex: 1,
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
    rowMeta: css({
      marginTop: theme.spacing(0.5),
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(0.25),
    }),
  };
}
