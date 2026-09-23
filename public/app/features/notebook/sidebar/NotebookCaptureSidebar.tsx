import { css, cx } from '@emotion/css';
import { DragDropContext, Draggable, Droppable, type DropResult } from '@hello-pangea/dnd';
import { skipToken } from '@reduxjs/toolkit/query';
import { type FormEvent, type KeyboardEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useLocalStorage } from 'react-use';

import { type GrafanaTheme2, type SelectableValue } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { locationService } from '@grafana/runtime';
import {
  Alert,
  Button,
  Field,
  Icon,
  IconButton,
  Input,
  LinkButton,
  Select,
  Spinner,
  Stack,
  Text,
  TextArea,
  useStyles2,
} from '@grafana/ui';
import { useGetNotebookQuery } from 'app/api/clients/dashboard/v2beta1';

import { useNotebookPicker } from '../addPanel/useNotebookPicker';
import { createNotebook, NotebookConflictError, updateNotebookSpec } from '../api/notebookResource';
import { canCreateNotebooks, canEditNotebooks } from '../permissions';
import { type Spec as NotebookSpec, defaultSpec as defaultNotebookSpec } from '../types';
import { NOTEBOOKS_BASE_URL, notebookEditHref, notebookViewHref } from '../urls';

import { appendNoteToNotebook } from './appendNoteToNotebook';
import { moveNotebookCell } from './moveNotebookCell';
import { getNotebookOutlineItems, type NotebookPreviewItem } from './notebookPreview';
import { removeNotebookCell } from './removeNotebookCell';

const SELECTED_NOTEBOOK_STORAGE_KEY = 'grafana.notebooks.capture-sidebar.selected';
const SELECTED_NOTEBOOK_URL_PARAM = 'notebookCapture';

export default function NotebookCaptureSidebar() {
  const styles = useStyles2(getStyles);
  const picker = useNotebookPicker();
  const canCreate = canCreateNotebooks();
  const canEdit = canEditNotebooks();
  const [storedUid, setStoredUid] = useLocalStorage<string>(SELECTED_NOTEBOOK_STORAGE_KEY);
  const [createdNotebook, setCreatedNotebook] = useState<{ uid: string; title: string }>();
  const notebooks = useMemo(() => {
    const available = picker.rows.map(({ uid, title }) => ({ uid, title }));
    return createdNotebook && !available.some((notebook) => notebook.uid === createdNotebook.uid)
      ? [createdNotebook, ...available]
      : available;
  }, [createdNotebook, picker.rows]);
  const urlUid = locationService.getSearchObject()[SELECTED_NOTEBOOK_URL_PARAM];
  const preferredUid = typeof urlUid === 'string' ? urlUid : storedUid;
  const selectedUid = notebooks.some((notebook) => notebook.uid === preferredUid) ? preferredUid : notebooks[0]?.uid;
  const selectedNotebook = notebooks.find((notebook) => notebook.uid === selectedUid);
  const notebookQuery = useGetNotebookQuery(selectedUid ? { name: selectedUid } : skipToken);
  const [note, setNote] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isReordering, setIsReordering] = useState(false);
  const [pendingDeleteElementName, setPendingDeleteElementName] = useState<string>();
  const [deletingElementName, setDeletingElementName] = useState<string>();
  const [saveError, setSaveError] = useState<string>();
  const [saved, setSaved] = useState(false);
  const [optimisticItems, setOptimisticItems] = useState<NotebookPreviewItem[]>();
  const [isCreating, setIsCreating] = useState(false);
  const [newNotebookTitle, setNewNotebookTitle] = useState('');
  const [isCreatingNotebook, setIsCreatingNotebook] = useState(false);
  const [createError, setCreateError] = useState<string>();
  const outlineListRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const focusComposerAfterCreateRef = useRef(false);

  useEffect(() => {
    if (selectedUid && selectedUid !== storedUid) {
      setStoredUid(selectedUid);
    }
    if (selectedUid && selectedUid !== urlUid) {
      locationService.partial({ [SELECTED_NOTEBOOK_URL_PARAM]: selectedUid }, true);
    }
  }, [selectedUid, setStoredUid, storedUid, urlUid]);

  useEffect(() => {
    setSaveError(undefined);
    setPendingDeleteElementName(undefined);
  }, [selectedUid]);

  useEffect(() => {
    if (!isCreating && focusComposerAfterCreateRef.current) {
      focusComposerAfterCreateRef.current = false;
      requestAnimationFrame(() => composerRef.current?.focus());
    }
  }, [isCreating, selectedUid]);

  const options: Array<SelectableValue<string>> = useMemo(
    () => notebooks.map((notebook) => ({ label: notebook.title, value: notebook.uid })),
    [notebooks]
  );

  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- generated client type bridged to the notebook schema at the read seam
  const spec = notebookQuery.data?.spec as NotebookSpec | undefined;
  const remoteOutlineItems = useMemo(() => (spec ? getNotebookOutlineItems(spec) : []), [spec]);
  const outlineItems = optimisticItems ?? remoteOutlineItems;

  useEffect(() => {
    setOptimisticItems(undefined);
  }, [selectedUid]);

  const isUpdating = isSaving || isReordering || Boolean(deletingElementName);

  const saveNote = async () => {
    const text = note.trim();
    if (!text || isUpdating || (!selectedUid && !canCreate)) {
      return;
    }

    setIsSaving(true);
    setSaveError(undefined);
    setSaved(false);

    try {
      if (!selectedUid) {
        const title = defaultCaptureNotebookTitle();
        const created = await createNotebook(appendNoteToNotebook({ ...defaultNotebookSpec(), title }, text));
        setCreatedNotebook({ uid: created.uid, title });
        selectNotebook(created.uid);
        setNote('');
        setSaved(true);
        return;
      }

      await updateNotebookSpec(selectedUid, (current) => appendNoteToNotebook(current, text));
      setNote('');
      setSaved(true);
      await notebookQuery.refetch();
      requestAnimationFrame(() => {
        outlineListRef.current?.scrollTo({ top: outlineListRef.current.scrollHeight, behavior: 'smooth' });
      });
    } catch (error) {
      setSaveError(captureErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  };

  const deleteBlock = async (item: NotebookPreviewItem) => {
    if (!selectedUid || isUpdating) {
      return;
    }

    setDeletingElementName(item.elementName);
    setPendingDeleteElementName(undefined);
    setOptimisticItems(outlineItems.filter((candidate) => candidate.elementName !== item.elementName));
    setSaveError(undefined);
    setSaved(false);

    try {
      await updateNotebookSpec(selectedUid, (current) => removeNotebookCell(current, item.elementName));
      await notebookQuery.refetch();
      setOptimisticItems(undefined);
    } catch (error) {
      setOptimisticItems(undefined);
      setSaveError(captureErrorMessage(error));
    } finally {
      setDeletingElementName(undefined);
    }
  };

  const onBlockDragEnd = async (result: DropResult) => {
    if (!selectedUid || !result.destination || result.destination.index === result.source.index || isUpdating) {
      return;
    }

    const moved = outlineItems[result.source.index];
    if (!moved) {
      return;
    }

    const nextItems = [...outlineItems];
    nextItems.splice(result.source.index, 1);
    nextItems.splice(result.destination.index, 0, moved);
    setOptimisticItems(nextItems);
    setIsReordering(true);
    setSaveError(undefined);
    setSaved(false);

    try {
      await updateNotebookSpec(selectedUid, (current) =>
        moveNotebookCell(current, moved.elementName, result.destination!.index)
      );
      await notebookQuery.refetch();
      setOptimisticItems(undefined);
    } catch (error) {
      setOptimisticItems(undefined);
      setSaveError(captureErrorMessage(error));
    } finally {
      setIsReordering(false);
    }
  };

  const onComposerKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      void saveNote();
    }
  };

  const selectNotebook = (uid: string) => {
    setSaved(false);
    setStoredUid(uid);
    locationService.partial({ [SELECTED_NOTEBOOK_URL_PARAM]: uid }, true);
  };

  const onCreateNotebook = async (event: FormEvent) => {
    event.preventDefault();
    const title = newNotebookTitle.trim();
    if (!title || isCreatingNotebook) {
      return;
    }
    if (notebooks.some((notebook) => notebook.title.trim().toLowerCase() === title.toLowerCase())) {
      setCreateError(t('notebooks.capture-sidebar.create-duplicate', 'A notebook with this name already exists.'));
      return;
    }

    setIsCreatingNotebook(true);
    setCreateError(undefined);
    try {
      const created = await createNotebook({ ...defaultNotebookSpec(), title });
      setCreatedNotebook({ uid: created.uid, title });
      selectNotebook(created.uid);
      setNewNotebookTitle('');
      focusComposerAfterCreateRef.current = true;
      setIsCreating(false);
    } catch (error) {
      setCreateError(
        error instanceof Error && error.message
          ? error.message
          : t('notebooks.capture-sidebar.create-error', 'Could not create notebook.')
      );
    } finally {
      setIsCreatingNotebook(false);
    }
  };

  const composer = (
    <section className={styles.composerSection}>
      <TextArea
        ref={composerRef}
        aria-label={t('notebooks.capture-sidebar.note-label', 'Add a note')}
        value={note}
        onChange={(event) => {
          setNote(event.currentTarget.value);
          setSaved(false);
        }}
        onKeyDown={onComposerKeyDown}
        placeholder={t('notebooks.capture-sidebar.note-placeholder', 'Add a note…')}
        rows={3}
      />

      <Button
        fullWidth
        icon="plus"
        disabled={!note.trim() || isUpdating || (Boolean(selectedUid) && notebookQuery.isError)}
        onClick={saveNote}
      >
        {isSaving ? (
          <Trans i18nKey="notebooks.capture-sidebar.saving">Saving…</Trans>
        ) : (
          <Trans i18nKey="notebooks.capture-sidebar.add-note">Add note</Trans>
        )}
      </Button>

      {saved && selectedNotebook && (
        <div role="status" aria-live="polite">
          <Stack direction="row" gap={0.5} alignItems="center">
            <Icon name="check" size="sm" />
            <Text color="success" variant="bodySmall">
              <Trans i18nKey="notebooks.capture-sidebar.saved">Saved</Trans>
            </Text>
          </Stack>
        </div>
      )}

      {saveError && (
        <Alert severity="error" title={t('notebooks.capture-sidebar.save-error', 'Could not update notebook')}>
          {saveError}
        </Alert>
      )}
    </section>
  );

  return (
    <div className={styles.container} data-testid="notebook-capture-sidebar">
      <header className={styles.header}>
        <Text element="h2" variant="h4">
          <Trans i18nKey="notebooks.capture-sidebar.title">Notebook</Trans>
        </Text>
        <Stack direction="row" gap={0.5} alignItems="center">
          <LinkButton
            aria-label={t('notebooks.capture-sidebar.view-all-label', 'All notebooks')}
            fill="text"
            size="sm"
            variant="secondary"
            href={NOTEBOOKS_BASE_URL}
          >
            <Trans i18nKey="notebooks.capture-sidebar.view-all">All notebooks</Trans>
          </LinkButton>
          {canCreate && (
            <IconButton
              className={styles.iconButton}
              name="plus"
              size="md"
              tooltip={t('notebooks.capture-sidebar.new', 'New notebook')}
              onClick={() => {
                setIsCreating(true);
                setCreateError(undefined);
              }}
            />
          )}
        </Stack>
      </header>

      {isCreating ? (
        <form className={styles.createSection} onSubmit={onCreateNotebook}>
          <Field
            label={t('notebooks.capture-sidebar.create-name', 'Notebook name')}
            invalid={Boolean(createError)}
            error={createError}
            noMargin
          >
            <Input
              autoFocus
              value={newNotebookTitle}
              disabled={isCreatingNotebook}
              onChange={(event) => {
                setNewNotebookTitle(event.currentTarget.value);
                setCreateError(undefined);
              }}
              placeholder={t('notebooks.capture-sidebar.create-placeholder', 'Investigation name')}
            />
          </Field>
          <Stack direction="row" gap={1} justifyContent="flex-end">
            <Button
              variant="secondary"
              disabled={isCreatingNotebook}
              onClick={() => {
                setIsCreating(false);
                setCreateError(undefined);
              }}
            >
              <Trans i18nKey="notebooks.capture-sidebar.cancel-create">Cancel</Trans>
            </Button>
            <Button type="submit" disabled={!newNotebookTitle.trim() || isCreatingNotebook}>
              {isCreatingNotebook ? (
                <Trans i18nKey="notebooks.capture-sidebar.creating">Creating…</Trans>
              ) : (
                <Trans i18nKey="notebooks.capture-sidebar.create-action">Create</Trans>
              )}
            </Button>
          </Stack>
        </form>
      ) : picker.isLoading ? (
        <div
          className={styles.centered}
          role="status"
          aria-label={t('notebooks.capture-sidebar.loading', 'Loading notebooks')}
        >
          <Spinner />
        </div>
      ) : picker.error ? (
        <Alert severity="error" title={t('notebooks.capture-sidebar.load-error', 'Failed to load notebooks')} />
      ) : notebooks.length === 0 ? (
        <>
          <div className={styles.empty}>
            <div className={styles.emptyIcon}>
              <Icon name="book" size="xl" />
            </div>
            <Text element="h3" variant="h5" textAlignment="center">
              <Trans i18nKey="notebooks.capture-sidebar.empty-title">No notebooks yet</Trans>
            </Text>
            <Text color="secondary" textAlignment="center">
              {canCreate ? (
                <Trans i18nKey="notebooks.capture-sidebar.empty-description">Add a note to start one.</Trans>
              ) : (
                <Trans i18nKey="notebooks.capture-sidebar.empty-no-access-description">
                  Ask someone with access to create one.
                </Trans>
              )}
            </Text>
          </div>
          {canCreate && composer}
        </>
      ) : (
        <>
          <section className={styles.notebookSection}>
            <div className={styles.destinationRow}>
              <div className={styles.destinationSelect}>
                <Select
                  aria-label={t('notebooks.capture-sidebar.destination', 'Notebook')}
                  options={options}
                  value={selectedUid}
                  onChange={(option) => option?.value && selectNotebook(option.value)}
                />
              </div>
              {selectedUid && (
                <LinkButton
                  className={styles.openButton}
                  fill="outline"
                  size="sm"
                  variant="secondary"
                  href={canEdit ? notebookEditHref(selectedUid) : notebookViewHref(selectedUid)}
                  icon="external-link-alt"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={
                    canEdit
                      ? t('notebooks.capture-sidebar.edit-label', 'Edit notebook in new tab')
                      : t('notebooks.capture-sidebar.open-label', 'Open notebook in new tab')
                  }
                >
                  {canEdit ? (
                    <Trans i18nKey="notebooks.capture-sidebar.edit">Edit</Trans>
                  ) : (
                    <Trans i18nKey="notebooks.capture-sidebar.open">Open</Trans>
                  )}
                </LinkButton>
              )}
            </div>

            <div className={styles.sectionHeader}>
              <Text element="h3" variant="h6">
                <Trans i18nKey="notebooks.capture-sidebar.contents">Contents</Trans>
              </Text>
              <Text color="secondary" variant="bodySmall">
                {isReordering ? (
                  <Trans i18nKey="notebooks.capture-sidebar.saving-order">Saving…</Trans>
                ) : deletingElementName ? (
                  <Trans i18nKey="notebooks.capture-sidebar.deleting-content">Deleting…</Trans>
                ) : (
                  <Trans i18nKey="notebooks.capture-sidebar.reorder-hint">Drag to reorder</Trans>
                )}
              </Text>
            </div>

            {notebookQuery.isLoading ? (
              <div className={styles.previewLoading}>
                <Spinner inline />
              </div>
            ) : notebookQuery.isError ? (
              <Text color="secondary" variant="bodySmall">
                <Trans i18nKey="notebooks.capture-sidebar.preview-error">Notebook contents could not be loaded.</Trans>
              </Text>
            ) : outlineItems.length === 0 ? (
              <div className={styles.previewEmpty}>
                <Text color="secondary" variant="bodySmall">
                  <Trans i18nKey="notebooks.capture-sidebar.no-items">No content yet.</Trans>
                </Text>
              </div>
            ) : (
              <DragDropContext onDragStart={() => setPendingDeleteElementName(undefined)} onDragEnd={onBlockDragEnd}>
                <Droppable droppableId="notebook-capture-blocks">
                  {(droppable) => (
                    <div
                      ref={(element) => {
                        droppable.innerRef(element);
                        outlineListRef.current = element;
                      }}
                      {...droppable.droppableProps}
                      className={styles.previewList}
                    >
                      {outlineItems.map((item, index) => (
                        <Draggable
                          key={item.elementName}
                          draggableId={item.elementName}
                          index={index}
                          isDragDisabled={isUpdating}
                        >
                          {(draggable, snapshot) => (
                            <div
                              ref={draggable.innerRef}
                              {...draggable.draggableProps}
                              className={cx(styles.previewItem, snapshot.isDragging && styles.previewItemDragging)}
                            >
                              <div
                                {...draggable.dragHandleProps}
                                className={styles.dragHandle}
                                aria-label={t('notebooks.capture-sidebar.drag-block', 'Drag to reorder {{label}}', {
                                  label: item.label,
                                })}
                              >
                                <Icon name="draggabledots" size="sm" />
                              </div>
                              <PreviewItem item={item} />
                              {pendingDeleteElementName === item.elementName ? (
                                <div
                                  className={styles.deleteActions}
                                  role="group"
                                  aria-label={t(
                                    'notebooks.capture-sidebar.delete-block-confirm-label',
                                    'Delete {{label}}?',
                                    { label: item.label }
                                  )}
                                >
                                  <Button
                                    fill="text"
                                    size="sm"
                                    variant="destructive"
                                    onClick={() => void deleteBlock(item)}
                                  >
                                    <Trans i18nKey="notebooks.capture-sidebar.delete-block-confirm">Delete</Trans>
                                  </Button>
                                  <Button
                                    autoFocus
                                    fill="text"
                                    size="sm"
                                    variant="secondary"
                                    onClick={() => setPendingDeleteElementName(undefined)}
                                  >
                                    <Trans i18nKey="notebooks.capture-sidebar.delete-block-cancel">Cancel</Trans>
                                  </Button>
                                </div>
                              ) : (
                                <IconButton
                                  className={styles.iconButton}
                                  name="trash-alt"
                                  size="sm"
                                  tooltip={t('notebooks.capture-sidebar.delete-block-label', 'Delete {{label}}', {
                                    label: item.label,
                                  })}
                                  disabled={isUpdating}
                                  onClick={() => setPendingDeleteElementName(item.elementName)}
                                />
                              )}
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {droppable.placeholder}
                    </div>
                  )}
                </Droppable>
              </DragDropContext>
            )}
          </section>

          {composer}
        </>
      )}
    </div>
  );
}

function PreviewItem({ item }: { item: NotebookPreviewItem }) {
  const styles = useStyles2(getStyles);
  const icon = item.kind === 'note' ? 'document-info' : item.kind === 'code' ? 'brackets-curly' : 'graph-bar';

  return (
    <div className={styles.previewContent} title={item.label}>
      <div className={styles.previewIcon}>
        <Icon name={icon} size="sm" />
      </div>
      <div
        className={cx(
          styles.previewLabel,
          item.kind === 'note' ? styles.notePreview : styles.singleLinePreview,
          item.kind === 'code' && styles.codePreview
        )}
      >
        <Text variant="bodySmall">{item.label}</Text>
      </div>
    </div>
  );
}

function captureErrorMessage(error: unknown): string {
  if (error instanceof NotebookConflictError) {
    return t(
      'notebooks.capture-sidebar.conflict',
      'This notebook changed while you were updating it. Try again with the latest version.'
    );
  }

  return error instanceof Error && error.message
    ? error.message
    : t('notebooks.capture-sidebar.unknown-error', 'Something went wrong while updating the notebook.');
}

function defaultCaptureNotebookTitle(): string {
  const date = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date());
  return t('notebooks.capture-sidebar.default-title', 'Investigation — {{date}}', { date });
}

const getStyles = (theme: GrafanaTheme2) => ({
  container: css({
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    minHeight: 0,
  }),
  header: css({
    alignItems: 'center',
    borderBottom: `1px solid ${theme.colors.border.weak}`,
    display: 'flex',
    justifyContent: 'space-between',
    padding: theme.spacing(2),
  }),
  composerSection: css({
    borderTop: `1px solid ${theme.colors.border.weak}`,
    display: 'flex',
    flexDirection: 'column',
    flexShrink: 0,
    gap: theme.spacing(1),
    padding: theme.spacing(1.5, 2),
  }),
  createSection: css({
    borderBottom: `1px solid ${theme.colors.border.weak}`,
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2),
    padding: theme.spacing(2),
  }),
  notebookSection: css({
    display: 'flex',
    flex: 1,
    flexDirection: 'column',
    gap: theme.spacing(1.5),
    minHeight: 0,
    padding: theme.spacing(2),
  }),
  destinationRow: css({
    alignItems: 'center',
    display: 'flex',
    gap: theme.spacing(1),
  }),
  destinationSelect: css({
    flex: 1,
    minWidth: 0,
  }),
  openButton: css({
    alignSelf: 'flex-end',
    flexShrink: 0,
    height: theme.spacing(4),
  }),
  sectionHeader: css({
    alignItems: 'center',
    display: 'flex',
    justifyContent: 'space-between',
  }),
  previewList: css({
    display: 'flex',
    flex: 1,
    flexDirection: 'column',
    gap: theme.spacing(1),
    minHeight: 0,
    overflowY: 'auto',
  }),
  previewItem: css({
    alignItems: 'center',
    background: theme.colors.background.secondary,
    border: `1px solid ${theme.colors.border.weak}`,
    borderRadius: theme.shape.radius.default,
    display: 'flex',
    minWidth: 0,
    padding: theme.spacing(0.5),
    [theme.transitions.handleMotion('no-preference', 'reduce')]: {
      transition: theme.transitions.create(['background-color', 'border-color', 'box-shadow'], {
        duration: theme.transitions.duration.shortest,
      }),
    },
  }),
  previewItemDragging: css({
    background: theme.colors.background.primary,
    borderColor: theme.colors.primary.border,
    boxShadow: theme.shadows.z3,
    zIndex: 1,
  }),
  deleteActions: css({
    display: 'flex',
    flexShrink: 0,
    gap: theme.spacing(0.5),
  }),
  iconButton: css({
    '& svg': {
      pointerEvents: 'none',
    },
  }),
  previewContent: css({
    alignItems: 'center',
    display: 'flex',
    flex: 1,
    gap: theme.spacing(1),
    minWidth: 0,
    padding: theme.spacing(0.5),
  }),
  previewLabel: css({
    minWidth: 0,
  }),
  notePreview: css({
    display: '-webkit-box',
    overflow: 'hidden',
    WebkitBoxOrient: 'vertical',
    WebkitLineClamp: 2,
  }),
  singleLinePreview: css({
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  }),
  codePreview: css({
    fontFamily: theme.typography.fontFamilyMonospace,
  }),
  dragHandle: css({
    alignItems: 'center',
    color: theme.colors.text.secondary,
    cursor: 'grab',
    display: 'flex',
    padding: theme.spacing(0.5),
  }),
  previewIcon: css({
    alignItems: 'center',
    color: theme.colors.text.secondary,
    display: 'flex',
    flexShrink: 0,
  }),
  previewLoading: css({
    padding: theme.spacing(2),
    textAlign: 'center',
  }),
  previewEmpty: css({
    background: theme.colors.background.secondary,
    borderRadius: theme.shape.radius.default,
    padding: theme.spacing(2),
    textAlign: 'center',
  }),
  centered: css({
    alignItems: 'center',
    display: 'flex',
    flex: 1,
    justifyContent: 'center',
  }),
  empty: css({
    alignItems: 'center',
    display: 'flex',
    flex: 1,
    flexDirection: 'column',
    gap: theme.spacing(1.5),
    justifyContent: 'center',
    padding: theme.spacing(3),
  }),
  emptyIcon: css({
    alignItems: 'center',
    background: theme.colors.background.secondary,
    borderRadius: theme.shape.radius.circle,
    color: theme.colors.text.secondary,
    display: 'flex',
    height: theme.spacing(6),
    justifyContent: 'center',
    width: theme.spacing(6),
  }),
});
