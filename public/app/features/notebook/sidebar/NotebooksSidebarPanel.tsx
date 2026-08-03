import { css, cx } from '@emotion/css';
import { DragDropContext, Draggable, Droppable, type DropResult } from '@hello-pangea/dnd';
import { skipToken } from '@reduxjs/toolkit/query';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom-v5-compat';

import { type GrafanaTheme2, type SelectableValue } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { locationService } from '@grafana/runtime';
import { useFlagDashboardNotebooks } from '@grafana/runtime/internal';
import {
  Alert,
  Button,
  Icon,
  IconButton,
  LinkButton,
  Select,
  Spinner,
  Stack,
  Text,
  TextArea,
  useStyles2,
} from '@grafana/ui';
import { useListNotebookQuery } from 'app/api/clients/dashboard/v2beta1';
import { useExtensionSidebarContext } from 'app/core/components/AppChrome/ExtensionSidebar/ExtensionSidebarProvider';
import { contextSrv } from 'app/core/services/context_srv';
import { AccessControlAction } from 'app/types/accessControl';

import { createNotebook, notebookEditUrl, notebookViewUrl } from '../api/notebookAPI';
import { mergeRemoteSpec } from '../collab/mergeRemoteSpec';
import { resourceVersionTs, useNotebookCollab } from '../collab/useNotebookCollab';
import { MarkdownCellEditor } from '../editor/cells/MarkdownCellEditor';
import { PanelCellView } from '../editor/cells/PanelCellView';
import { useNotebookEditorState } from '../editor/useNotebookEditorState';
import { getLastUsedNotebook } from '../model/lastUsedNotebook';
import {
  insertElement,
  moveCell,
  newMarkdownElement,
  newNotebookSpec,
  newNotebookTitleDate,
  removeCellAt,
  resolveCells,
  updateMarkdownText,
} from '../model/notebookSpec';

const SIDEBAR_PANEL_HEIGHT = 180;

/**
 * The notebooks workspace panel, docked in the extension sidebar so notebooks are
 * reachable next to any Grafana page. Hosts a compact editor for the selected
 * notebook (markdown editing, reorder, live panels) plus a capture box pinned at
 * the bottom — jot findings without leaving the dashboard or Explore.
 */
export function NotebooksSidebarPanel() {
  const notebooksEnabled = useFlagDashboardNotebooks();
  const styles = useStyles2(getStyles);
  const [selectedUid, setSelectedUid] = useState<string | undefined>(() => getLastUsedNotebook()?.uid);
  const location = useLocation();
  const canEditNotebooks =
    contextSrv.hasPermission(AccessControlAction.DashboardsCreate) ||
    contextSrv.hasPermission(AccessControlAction.DashboardsWrite);

  const { data, isLoading, error } = useListNotebookQuery(notebooksEnabled && canEditNotebooks ? {} : skipToken);

  // The sidebar follows along: navigating to a notebook page selects that notebook here.
  useEffect(() => {
    const match = location.pathname.match(/^\/(?:notebooks\/edit|notebook)\/([^/]+)/);
    if (match) {
      setSelectedUid(match[1]);
    }
  }, [location.pathname]);

  const options: Array<SelectableValue<string>> = useMemo(
    () =>
      (data?.items ?? [])
        .map((nb) => ({ label: nb.spec.title, value: nb.metadata.name ?? '' }))
        .filter((option) => option.value !== ''),
    [data]
  );

  if (!notebooksEnabled || !canEditNotebooks) {
    return null;
  }

  const effectiveUid = selectedUid && options.some((o) => o.value === selectedUid) ? selectedUid : options[0]?.value;

  const onCreate = async () => {
    const created = await createNotebook(
      newNotebookSpec(
        t('notebooks.list.new-notebook-title', 'Investigation — {{date}}', { date: newNotebookTitleDate() })
      )
    );
    setSelectedUid(created.metadata.name);
  };

  return (
    <div className={styles.panel} data-testid="notebooks-sidebar-panel">
      <div className={styles.header}>
        <Stack direction="row" gap={1} alignItems="center">
          <Icon name="book-open" />
          <Text element="h2" variant="h5">
            <Trans i18nKey="notebooks.sidebar.title">Notebooks</Trans>
          </Text>
        </Stack>
        <Stack direction="row" gap={0.5}>
          <LinkButton size="sm" fill="text" variant="secondary" href="/notebooks">
            <Trans i18nKey="notebooks.sidebar.view-all">View all</Trans>
          </LinkButton>
          <Button size="sm" icon="plus" variant="secondary" onClick={onCreate}>
            <Trans i18nKey="notebooks.sidebar.new">New</Trans>
          </Button>
        </Stack>
      </div>

      {isLoading && <Spinner />}

      {!isLoading && Boolean(error) && (
        <Alert severity="error" title={t('notebooks.sidebar.load-error', 'Failed to load notebooks')} />
      )}

      {!isLoading && !error && options.length === 0 && (
        <Text color="secondary">
          <Trans i18nKey="notebooks.sidebar.empty">No notebooks yet — create one to start capturing findings.</Trans>
        </Text>
      )}

      {options.length > 0 && (
        <Select
          options={options}
          value={effectiveUid}
          onChange={(option) => setSelectedUid(option?.value)}
          aria-label={t('notebooks.sidebar.picker', 'Notebook')}
        />
      )}

      {effectiveUid && <SidebarNotebookEditor key={effectiveUid} uid={effectiveUid} />}
    </div>
  );
}

/**
 * Compact inline editor for one notebook. Joins the same Live collaboration channel
 * as the full editor, so sidebar edits show up live in open editors (and vice versa),
 * and the sidebar counts as a presence.
 */
function SidebarNotebookEditor({ uid }: { uid: string }) {
  const styles = useStyles2(getStyles);
  const editor = useNotebookEditorState(uid);
  const { spec, loading, loadError, dirty, saving } = editor.state;
  const { setDockedComponentId } = useExtensionSidebarContext();
  const [note, setNote] = useState('');
  const [editingKey, setEditingKey] = useState<string | null>(null);

  // Jumping to the full page is a context switch — the sidebar closes with it.
  const onNavigate = (url: string) => {
    setDockedComponentId(undefined);
    locationService.push(url);
  };
  const editingKeyRef = useRef<string | null>(null);
  editingKeyRef.current = editingKey;
  const blocksRef = useRef<HTMLDivElement>(null);

  const collab = useNotebookCollab({
    uid,
    enabled: !loading && !!spec,
    getSpec: editor.getSpec,
    initialDocTs: resourceVersionTs(editor.state.resource),
    onRemoteSpec: useCallback(
      (remoteSpec) => {
        editor.applyRemoteSpec(mergeRemoteSpec(remoteSpec, editor.getSpec(), editingKeyRef.current));
      },
      [editor]
    ),
  });

  const update = useCallback(
    (mutate: Parameters<typeof editor.updateSpec>[0]) => {
      editor.updateSpec(mutate);
      collab.notifyLocalEdit();
    },
    [editor, collab]
  );

  if (loadError) {
    return <Alert severity="error" title={t('notebooks.editor.load-error', 'Failed to load notebook')} />;
  }

  if (loading || !spec) {
    return <Spinner />;
  }

  const cells = resolveCells(spec);

  const onAddNote = () => {
    const text = note.trim();
    if (!text) {
      return;
    }
    let newKey: string | undefined;
    update((s) => {
      const result = insertElement(s, newMarkdownElement(text), { source: 'user' });
      newKey = result.elementName;
      return result.spec;
    });
    if (newKey) {
      collab.sendActivity(t('notebooks.activity.added-note', 'added a note'), newKey);
    }
    setNote('');
    // New notes append at the end; keep them in view.
    requestAnimationFrame(() => {
      blocksRef.current?.scrollTo({ top: blocksRef.current.scrollHeight, behavior: 'smooth' });
    });
  };

  const onDragEnd = (result: DropResult) => {
    if (result.destination && result.destination.index !== result.source.index) {
      update((s) => moveCell(s, result.source.index, result.destination!.index));
    }
  };

  return (
    <div className={styles.editor}>
      <div className={styles.blocks} ref={blocksRef}>
        {cells.length === 0 ? (
          <div className={styles.blocksEmpty}>
            <Icon name="document-info" size="lg" />
            <Text variant="bodySmall" color="secondary" textAlignment="center">
              <Trans i18nKey="notebooks.sidebar.no-blocks">
                Nothing here yet — capture your first note below, or add panels from any dashboard.
              </Trans>
            </Text>
          </div>
        ) : (
          <DragDropContext onDragEnd={onDragEnd}>
            <Droppable droppableId="notebook-sidebar-cells">
              {(droppable) => (
                <div ref={droppable.innerRef} {...droppable.droppableProps} className={styles.cells}>
                  {cells.map((cell, index) => {
                    const { element, elementName } = cell;

                    return (
                      <Draggable draggableId={elementName} index={index} key={elementName}>
                        {(draggable, snapshot) => (
                          <div
                            ref={draggable.innerRef}
                            {...draggable.draggableProps}
                            className={cx(styles.cellRow, snapshot.isDragging && styles.cellDragging)}
                          >
                            <div
                              className={cx('sidebar-cell-drag-handle', styles.cellDragHandle)}
                              {...draggable.dragHandleProps}
                              aria-label={t('notebooks.cell.drag', 'Drag to reorder block')}
                            >
                              <Icon name="draggabledots" size="sm" />
                            </div>
                            <div className={styles.cellBody}>
                              {element.kind === 'Panel' && (
                                <PanelCellView
                                  panel={element}
                                  timeFrom={cell.timeFrom ?? spec.timeSettings.from}
                                  timeTo={cell.timeTo ?? spec.timeSettings.to}
                                  height={SIDEBAR_PANEL_HEIGHT}
                                />
                              )}
                              {element.kind === 'LibraryPanel' && <Text color="secondary">{element.spec.title}</Text>}
                              {element.kind === 'Cell' && element.spec.content.kind === 'Markdown' && (
                                <MarkdownCellEditor
                                  value={element.spec.content.spec.text}
                                  editing={editingKey === elementName}
                                  onStartEdit={() => setEditingKey(elementName)}
                                  onChange={(text) => update((s) => updateMarkdownText(s, elementName, text))}
                                  onDone={() => setEditingKey(null)}
                                />
                              )}
                              {element.kind === 'Cell' && element.spec.content.kind === 'Code' && (
                                <pre className={styles.code}>{element.spec.content.spec.code}</pre>
                              )}
                            </div>
                            <div className={cx('sidebar-cell-actions', styles.cellActions)}>
                              <IconButton
                                name="trash-alt"
                                size="sm"
                                tooltip={t('notebooks.sidebar.delete-block', 'Delete block')}
                                onClick={() => update((s) => removeCellAt(s, index))}
                              />
                            </div>
                          </div>
                        )}
                      </Draggable>
                    );
                  })}
                  {droppable.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>
        )}
      </div>

      <div className={styles.footer}>
        <Text variant="bodySmall" color="secondary">
          {saving
            ? t('notebooks.editor.status-saving', 'Saving…')
            : dirty
              ? t('notebooks.editor.status-unsaved', 'Unsaved changes')
              : t('notebooks.sidebar.status-synced', 'All changes saved')}
        </Text>
        <Stack direction="row" gap={0.25}>
          <IconButton
            name="book-open"
            tooltip={t('notebooks.sidebar.open', 'Open notebook')}
            onClick={() => onNavigate(notebookViewUrl(uid))}
          />
          <IconButton
            name="pen"
            tooltip={t('notebooks.sidebar.edit', 'Open in editor')}
            onClick={() => onNavigate(notebookEditUrl(uid))}
          />
        </Stack>
      </div>

      <div className={styles.noteBox}>
        <TextArea
          value={note}
          rows={2}
          placeholder={t('notebooks.sidebar.note-placeholder', 'Jot a quick note — Enter to add')}
          onChange={(e) => setNote(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              onAddNote();
            }
          }}
          data-testid="notebooks-sidebar-note"
        />
        <IconButton
          name="message"
          size="lg"
          disabled={!note.trim()}
          onClick={onAddNote}
          tooltip={t('notebooks.sidebar.add-note', 'Add note (Enter)')}
        />
      </div>
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  panel: css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1.5),
    padding: theme.spacing(2, 2, 1.5, 2),
    height: '100%',
    overflow: 'hidden',
  }),
  header: css({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing(1),
    flexShrink: 0,
  }),
  editor: css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1),
    flex: 1,
    minHeight: 0,
  }),
  blocks: css({
    flex: 1,
    minHeight: 0,
    overflowY: 'auto',
    // Breathing room so hover outlines and the drag handle are not clipped.
    padding: theme.spacing(0.5, 0.5, 0.5, 0),
    margin: theme.spacing(-0.5, -0.5, 0, 0),
  }),
  blocksEmpty: css({
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing(1),
    height: '100%',
    minHeight: 120,
    color: theme.colors.text.secondary,
    border: `1px dashed ${theme.colors.border.medium}`,
    borderRadius: theme.shape.radius.default,
    padding: theme.spacing(2),
  }),
  cells: css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1.5),
  }),
  cellRow: css({
    position: 'relative',
    borderRadius: theme.shape.radius.default,
    padding: theme.spacing(0.5),
    paddingLeft: theme.spacing(2.5),

    '&:hover': {
      outline: `1px solid ${theme.colors.border.weak}`,
    },

    '&:hover .sidebar-cell-actions, &:hover .sidebar-cell-drag-handle': {
      opacity: 1,
    },
  }),
  cellDragging: css({
    outline: `1px solid ${theme.colors.primary.border}`,
    background: theme.colors.background.primary,
    boxShadow: theme.shadows.z2,
  }),
  cellDragHandle: css({
    position: 'absolute',
    left: 0,
    top: '50%',
    transform: 'translateY(-50%)',
    display: 'flex',
    alignItems: 'center',
    padding: theme.spacing(0, 0.25),
    opacity: 0,
    color: theme.colors.text.secondary,
    cursor: 'grab',
  }),
  cellBody: css({
    minWidth: 0,
  }),
  cellActions: css({
    position: 'absolute',
    top: theme.spacing(0.5),
    right: theme.spacing(0.5),
    display: 'flex',
    gap: theme.spacing(0.25),
    opacity: 0,
    background: theme.colors.background.primary,
    borderRadius: theme.shape.radius.default,
    zIndex: 2,
    padding: theme.spacing(0.25),
  }),
  code: css({
    background: theme.colors.background.secondary,
    borderRadius: theme.shape.radius.default,
    padding: theme.spacing(1),
    fontSize: theme.typography.bodySmall.fontSize,
    fontFamily: theme.typography.fontFamilyMonospace,
    overflow: 'auto',
    maxHeight: 160,
    margin: 0,
  }),
  footer: css({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing(1),
    borderTop: `1px solid ${theme.colors.border.weak}`,
    paddingTop: theme.spacing(0.75),
    flexShrink: 0,
  }),
  noteBox: css({
    display: 'flex',
    alignItems: 'flex-end',
    gap: theme.spacing(1),
    flexShrink: 0,
  }),
});

export default NotebooksSidebarPanel;
