import { css } from '@emotion/css';
import { DragDropContext, Draggable, Droppable, type DropResult } from '@hello-pangea/dnd';
import { useCallback, useEffect, useRef, useState } from 'react';

import {
  AppEvents,
  dateTimeFormatTimeAgo,
  rangeUtil,
  type GrafanaTheme2,
  type PanelData,
  type RawTimeRange,
} from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { locationService } from '@grafana/runtime';
import { type PanelKind, type Spec as NotebookSpec } from '@grafana/schema/apis/notebook/v2beta1';
import {
  Alert,
  Button,
  ConfirmModal,
  Dropdown,
  Icon,
  IconButton,
  Input,
  LinkButton,
  Menu,
  RefreshPicker,
  Stack,
  TagsInput,
  Text,
  TimeRangeInput,
  useStyles2,
} from '@grafana/ui';
import { appEvents } from 'app/core/app_events';
import { Page } from 'app/core/components/Page/Page';
import PageLoader from 'app/core/components/PageLoader/PageLoader';
import { copyStringToClipboard } from 'app/core/utils/explore';

import { deleteNotebook, notebookViewUrl } from '../api/notebookAPI';
import { ActivityFeedButton } from '../collab/ActivityFeed';
import { CollabCursors } from '../collab/CollabCursors';
import { PresenceAvatars } from '../collab/PresenceAvatars';
import { mergeRemoteSpec } from '../collab/mergeRemoteSpec';
import { useNotebookCollab } from '../collab/useNotebookCollab';
import { DeclareIncidentFromNotebookButton } from '../extensions/DeclareIncidentFromNotebookButton';
import { OpenInAssistantButton } from '../extensions/OpenInAssistantButton';
import { setLastUsedNotebook } from '../model/lastUsedNotebook';
import {
  clearCellTimeOverride,
  duplicateCellAt,
  insertElement,
  moveCell,
  newCodeElement,
  newMarkdownElement,
  removeCellAt,
  resolveCells,
  setCellCollapsed,
  setCellHeight,
  setCellTimeOverride,
  setNotebookTimeRange,
  setNotebookTitle,
  updateCodeCell,
  updateMarkdownText,
  updatePanelTitle,
  updatePanelViz,
  type ResolvedCell,
} from '../model/notebookSpec';
import { notebookToMarkdown } from '../model/notebookToMarkdown';

import { AddCellRow } from './AddCellRow';
import { InsertCellDivider } from './InsertCellDivider';
import { CellFrame } from './cells/CellFrame';
import { CodeCellEditor } from './cells/CodeCellEditor';
import { CollapsedCellSummary } from './cells/CollapsedCellSummary';
import { MarkdownCellEditor } from './cells/MarkdownCellEditor';
import { PanelCellView, getExploreUrlForPanel } from './cells/PanelCellView';
import { VizSuggestionsButton } from './cells/VizSuggestionsButton';
import { useNotebookEditorState } from './useNotebookEditorState';

interface Props {
  uid: string;
}

export function NotebookEditor({ uid }: Props) {
  const styles = useStyles2(getStyles);
  const editor = useNotebookEditorState(uid);
  const { spec, loading, loadError, saving, dirty, lastSavedAt } = editor.state;

  const [editingCellKey, setEditingCellKey] = useState<string | null>(null);
  const editingCellKeyRef = useRef<string | null>(null);
  editingCellKeyRef.current = editingCellKey;

  const [renamingKey, setRenamingKey] = useState<string | null>(null);
  const [timeEditKey, setTimeEditKey] = useState<string | null>(null);
  const [highlightKey, setHighlightKey] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [followSid, setFollowSid] = useState<string | null>(null);
  const documentRef = useRef<HTMLDivElement>(null);
  const highlightTimer = useRef<ReturnType<typeof setTimeout>>();
  // Latest query-result readers per panel cell, powering the viz suggestions previews.
  const dataReaders = useRef(new Map<string, () => PanelData | undefined>());

  // Opening a notebook makes it the target of the "Add to last notebook" quick actions.
  const loadedTitle = !loading && !loadError ? spec?.title : undefined;
  useEffect(() => {
    if (loadedTitle !== undefined) {
      setLastUsedNotebook(uid, loadedTitle);
    }
  }, [uid, loadedTitle]);

  const collab = useNotebookCollab({
    uid,
    enabled: !loading && !loadError,
    getSpec: editor.getSpec,
    onRemoteSpec: useCallback(
      (remoteSpec) => {
        editor.applyRemoteSpec(mergeRemoteSpec(remoteSpec, editor.getSpec(), editingCellKeyRef.current));
      },
      [editor]
    ),
  });

  // Every local mutation goes through here so collaborators get the update too.
  // Structural edits pass an `activity` label that lands in everyone's feed.
  const update = useCallback(
    (mutate: Parameters<typeof editor.updateSpec>[0], activity?: { label: string; cellKey?: string }) => {
      editor.updateSpec(mutate);
      collab.notifyLocalEdit();
      if (activity) {
        collab.sendActivity(activity.label, activity.cellKey);
      }
    },
    [editor, collab]
  );

  const undo = useCallback(() => {
    if (editor.undo()) {
      collab.notifyLocalEdit();
    }
  }, [editor, collab]);

  const redo = useCallback(() => {
    if (editor.redo()) {
      collab.notifyLocalEdit();
    }
  }, [editor, collab]);

  const jumpToCell = useCallback((cellKey: string) => {
    document.querySelector(`[data-cell-key="${CSS.escape(cellKey)}"]`)?.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
    });
    setHighlightKey(cellKey);
    clearTimeout(highlightTimer.current);
    highlightTimer.current = setTimeout(() => setHighlightKey(null), 2500);
  }, []);

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const container = documentRef.current;
      if (!container) {
        return;
      }
      const rect = container.getBoundingClientRect();
      const target = e.target instanceof Element ? e.target : null;
      const hoveredCell = target?.closest('[data-cell-key]')?.getAttribute('data-cell-key') ?? null;
      collab.sendCursor(e.clientX - rect.left, e.clientY - rect.top, editingCellKeyRef.current ?? hoveredCell);
    },
    [collab]
  );

  const insertTextAt = useCallback(
    (index: number) => {
      let newKey: string | undefined;
      update((s) => {
        const result = insertElement(s, newMarkdownElement(''), { index });
        newKey = result.elementName;
        return result.spec;
      });
      if (newKey) {
        setEditingCellKey(newKey);
        collab.sendActivity(t('notebooks.activity.added-text', 'added a text block'), newKey);
      }
    },
    [update, collab]
  );

  const insertCodeAt = useCallback(
    (index: number) => {
      let newKey: string | undefined;
      update((s) => {
        const result = insertElement(s, newCodeElement('', ''), { index });
        newKey = result.elementName;
        return result.spec;
      });
      if (newKey) {
        collab.sendActivity(t('notebooks.activity.added-code', 'added a code block'), newKey);
      }
    },
    [update, collab]
  );

  const onDragEnd = useCallback(
    (result: DropResult) => {
      if (result.destination && result.destination.index !== result.source.index) {
        update((s) => moveCell(s, result.source.index, result.destination!.index), {
          label: t('notebooks.activity.moved-block', 'moved a block'),
          cellKey: result.draggableId,
        });
      }
    },
    [update]
  );

  // Cmd/Ctrl+S saves; Cmd/Ctrl+Z / Shift+Cmd/Ctrl+Z step through local history.
  // Undo/redo is left to the browser while typing in a field (native text undo).
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 's' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        editor.save();
        return;
      }
      if (e.key.toLowerCase() === 'z' && (e.metaKey || e.ctrlKey)) {
        const target = e.target instanceof HTMLElement ? e.target : null;
        const typing =
          target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
        if (typing) {
          return;
        }
        e.preventDefault();
        if (e.shiftKey) {
          redo();
        } else {
          undo();
        }
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [editor, undo, redo]);

  // Broadcast which block sits at our viewport center so collaborators can follow us.
  useEffect(() => {
    const onScroll = () => {
      const container = documentRef.current;
      if (!container) {
        return;
      }
      const centerY = window.innerHeight / 2;
      let best: { key: string; distance: number } | undefined;
      for (const node of container.querySelectorAll('[data-cell-key]')) {
        const rect = node.getBoundingClientRect();
        const distance = Math.abs((rect.top + rect.bottom) / 2 - centerY);
        const key = node.getAttribute('data-cell-key');
        if (key && (!best || distance < best.distance)) {
          best = { key, distance };
        }
      }
      collab.sendView(best?.key ?? null);
    };
    // Capture phase: the page content scrolls inside a nested scroller, not the window.
    window.addEventListener('scroll', onScroll, { capture: true, passive: true });
    return () => window.removeEventListener('scroll', onScroll, { capture: true });
  }, [collab]);

  // Follow mode: ride along with the followed collaborator's viewport.
  const followedPeer = followSid ? collab.peers.find((p) => p.sid === followSid) : undefined;
  const followedViewCell = followedPeer?.viewCell;
  useEffect(() => {
    if (!followSid) {
      return;
    }
    if (!followedPeer) {
      // The peer left; following ends with them.
      setFollowSid(null);
      return;
    }
    if (followedViewCell) {
      document.querySelector(`[data-cell-key="${CSS.escape(followedViewCell)}"]`)?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [followSid, followedPeer, followedViewCell]);

  // Any deliberate scroll input (wheel, touch) means the user wants their own viewport
  // back — these events only come from the user, never from scrollIntoView.
  useEffect(() => {
    if (!followSid) {
      return;
    }
    const stop = () => setFollowSid(null);
    window.addEventListener('wheel', stop, { passive: true });
    window.addEventListener('touchmove', stop, { passive: true });
    return () => {
      window.removeEventListener('wheel', stop);
      window.removeEventListener('touchmove', stop);
    };
  }, [followSid]);

  // Auto-refresh: re-run all panels on the notebook's refresh interval.
  const autoRefresh = spec?.timeSettings.autoRefresh;
  useEffect(() => {
    if (!autoRefresh) {
      return;
    }
    let ms: number;
    try {
      ms = rangeUtil.intervalToMs(autoRefresh);
    } catch {
      return;
    }
    if (!ms || ms < 1000) {
      return;
    }
    const timer = setInterval(() => setRefreshNonce((n) => n + 1), ms);
    return () => clearInterval(timer);
  }, [autoRefresh]);

  // Scroll to and briefly highlight a cell linked via ?cell= (used by "Add & open notebook").
  const isLoaded = !loading && !!spec;
  useEffect(() => {
    if (!isLoaded) {
      return;
    }
    const cellParam = new URLSearchParams(locationService.getLocation().search).get('cell');
    if (!cellParam) {
      return;
    }
    locationService.partial({ cell: null }, true);
    requestAnimationFrame(() => {
      document.querySelector(`[data-cell-key="${CSS.escape(cellParam)}"]`)?.scrollIntoView({ block: 'center' });
    });
    setHighlightKey(cellParam);
    const timer = setTimeout(() => setHighlightKey(null), 2500);
    return () => clearTimeout(timer);
  }, [isLoaded]);

  const openPanelInExplore = useCallback(async (panel: PanelKind, s: NotebookSpec) => {
    const url = await getExploreUrlForPanel(panel, s.timeSettings.from, s.timeSettings.to);
    if (url) {
      window.open(url, '_blank', 'noopener');
    }
  }, []);

  const onCopyMarkdown = useCallback(async () => {
    const current = editor.getSpec();
    if (!current) {
      return;
    }
    const markdown = notebookToMarkdown(current, {
      notebookUrl: new URL(notebookViewUrl(uid), window.location.origin).toString(),
    });
    copyStringToClipboard(markdown);
    appEvents.emit(AppEvents.alertSuccess, [t('notebooks.editor.copied-markdown', 'Notebook copied as Markdown')]);
  }, [editor, uid]);

  const pageNav = {
    text: spec?.title || t('notebooks.editor.untitled', 'Untitled notebook'),
    parentItem: { text: t('notebook.breadcrumb-title', 'Notebooks'), url: '/notebooks' },
  };

  if (loading) {
    return (
      <Page navId="notebooks" pageNav={pageNav}>
        <PageLoader />
      </Page>
    );
  }

  if (loadError || !spec) {
    return (
      <Page navId="notebooks" pageNav={pageNav}>
        <Page.Contents>
          <Alert severity="error" title={t('notebooks.editor.load-error', 'Failed to load notebook')}>
            {loadError instanceof Error ? loadError.message : ''}
          </Alert>
        </Page.Contents>
      </Page>
    );
  }

  const cells = resolveCells(spec);
  const timeRange = rangeUtil.convertRawToRange({ from: spec.timeSettings.from, to: spec.timeSettings.to });

  const moreMenu = (
    <Menu>
      <Menu.Item icon="copy" label={t('notebooks.editor.copy-markdown', 'Copy as Markdown')} onClick={onCopyMarkdown} />
      <Menu.Divider />
      <Menu.Item
        icon="trash-alt"
        destructive
        label={t('notebooks.editor.delete', 'Delete notebook')}
        onClick={() => setConfirmDelete(true)}
      />
    </Menu>
  );

  const actions = (
    <Stack direction="row" gap={1} alignItems="center" wrap="wrap" justifyContent="flex-end">
      <PresenceAvatars
        peers={collab.peers}
        followedSid={followSid}
        onToggleFollow={(peer) => setFollowSid((cur) => (cur === peer.sid ? null : peer.sid))}
      />
      <IconButton
        name="corner-up-left"
        size="lg"
        disabled={!editor.state.canUndo}
        onClick={undo}
        tooltip={t('notebooks.editor.undo', 'Undo (⌘Z)')}
      />
      <IconButton
        name="corner-up-right"
        size="lg"
        disabled={!editor.state.canRedo}
        onClick={redo}
        tooltip={t('notebooks.editor.redo', 'Redo (⇧⌘Z)')}
      />
      <ActivityFeedButton activity={collab.activity} onJumpToCell={jumpToCell} />
      <DeclareIncidentFromNotebookButton uid={uid} title={spec.title} />
      <OpenInAssistantButton uid={uid} spec={spec} />
      <TimeRangeInput
        value={timeRange}
        onChange={(tr) => update((s) => setNotebookTimeRange(s, rawToString(tr.raw.from), rawToString(tr.raw.to)))}
      />
      <RefreshPicker
        value={spec.timeSettings.autoRefresh}
        intervals={spec.timeSettings.autoRefreshIntervals}
        onRefresh={() => setRefreshNonce((n) => n + 1)}
        onIntervalChanged={(interval) =>
          update((s) => ({ ...s, timeSettings: { ...s.timeSettings, autoRefresh: interval } }))
        }
      />
      <LinkButton variant="primary" href={notebookViewUrl(uid)} icon="eye">
        <Trans i18nKey="notebooks.editor.done">Done</Trans>
      </LinkButton>
      <Dropdown overlay={moreMenu} placement="bottom-end">
        <IconButton name="ellipsis-v" tooltip={t('notebooks.editor.more', 'More actions')} size="lg" />
      </Dropdown>
    </Stack>
  );

  const titleInput = (
    <input
      className={styles.titleInput}
      value={spec.title}
      placeholder={t('notebooks.editor.title-placeholder', 'Give this notebook a title')}
      onChange={(e) => update((s) => setNotebookTitle(s, e.currentTarget.value))}
      aria-label={t('notebooks.editor.title-label', 'Notebook title')}
      data-testid="notebook-title-input"
    />
  );

  return (
    <Page navId="notebooks" pageNav={pageNav} renderTitle={() => titleInput} actions={actions}>
      <Page.Contents>
        {/* Pointer tracking is presence telemetry for collaborators, not an interaction. */}
        {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions */}
        <div className={styles.document} ref={documentRef} onPointerMove={onPointerMove}>
          <CollabCursors peers={collab.peers} />

          {followedPeer && (
            <div className={styles.followingPill} style={{ backgroundColor: followedPeer.color }}>
              <Icon name="eye" size="sm" />
              {t('notebooks.editor.following', 'Following {{name}}', {
                name: followedPeer.user.name || followedPeer.user.login,
              })}
              <IconButton
                name="times"
                size="sm"
                variant="secondary"
                tooltip={t('notebooks.editor.stop-following', 'Stop following')}
                onClick={() => setFollowSid(null)}
              />
            </div>
          )}

          <div className={styles.metaRow}>
            <TagsInput
              tags={spec.tags}
              onChange={(tags) => update((s) => ({ ...s, tags }))}
              placeholder={t('notebooks.editor.tags-placeholder', 'Add tags')}
              width={40}
            />
            <Text variant="bodySmall" color="secondary">
              {saveStatusText(saving, dirty, lastSavedAt)}
            </Text>
          </div>

          {cells.length === 0 ? (
            <EmptyNotebook onAddText={() => insertTextAt(0)} onAddCode={() => insertCodeAt(0)} />
          ) : (
            <DragDropContext onDragEnd={onDragEnd}>
              <Droppable droppableId="notebook-cells">
                {(droppable) => (
                  <div ref={droppable.innerRef} {...droppable.droppableProps} className={styles.cells}>
                    {cells.map((cell, index) => {
                      const peersInCell = collab.peers
                        .filter((p) => p.cellKey === cell.elementName)
                        .map((p) => ({ name: p.user.name || p.user.login, color: p.color }));

                      return (
                        <Draggable draggableId={cell.elementName} index={index} key={cell.elementName}>
                          {(draggable, snapshot) => (
                            <div
                              ref={draggable.innerRef}
                              {...draggable.draggableProps}
                              onFocusCapture={() => setEditingCellKey(cell.elementName)}
                              onBlurCapture={() => setEditingCellKey((cur) => (cur === cell.elementName ? null : cur))}
                            >
                              <InsertCellDivider
                                onInsertText={() => insertTextAt(index)}
                                onInsertCode={() => insertCodeAt(index)}
                              />
                              <CellFrame
                                cellKey={cell.elementName}
                                source={cell.source}
                                collapsed={cell.collapsed}
                                peers={peersInCell}
                                highlighted={highlightKey === cell.elementName}
                                isDragging={snapshot.isDragging}
                                dragHandleProps={draggable.dragHandleProps}
                                onToggleCollapse={() => update((s) => setCellCollapsed(s, index, !cell.collapsed))}
                                onDuplicate={() =>
                                  update((s) => duplicateCellAt(s, index), {
                                    label: t('notebooks.activity.duplicated-block', 'duplicated a block'),
                                    cellKey: cell.elementName,
                                  })
                                }
                                onDelete={() =>
                                  update((s) => removeCellAt(s, index), {
                                    label: t('notebooks.activity.deleted-block', 'deleted a block'),
                                  })
                                }
                                extraActions={
                                  cell.element.kind === 'Panel' && !cell.collapsed ? (
                                    <>
                                      <VizSuggestionsButton
                                        currentPluginId={cell.element.spec.vizConfig.group}
                                        getData={() => dataReaders.current.get(cell.elementName)?.()}
                                        onSelect={(suggestion) =>
                                          update((s) => updatePanelViz(s, cell.elementName, suggestion), {
                                            label: t('notebooks.activity.changed-viz', 'changed a visualization'),
                                            cellKey: cell.elementName,
                                          })
                                        }
                                      />
                                      <IconButton
                                        name="clock-nine"
                                        size="sm"
                                        onClick={() =>
                                          setTimeEditKey((cur) => (cur === cell.elementName ? null : cell.elementName))
                                        }
                                        tooltip={
                                          cell.timeFrom
                                            ? t('notebooks.cell.time-locked', 'Edit locked time range')
                                            : t('notebooks.cell.time-lock', 'Lock to a specific time range')
                                        }
                                      />
                                      <IconButton
                                        name="pen"
                                        size="sm"
                                        onClick={() => setRenamingKey(cell.elementName)}
                                        tooltip={t('notebooks.cell.rename', 'Rename panel')}
                                      />
                                      <IconButton
                                        name="compass"
                                        size="sm"
                                        onClick={() => {
                                          if (cell.element.kind === 'Panel') {
                                            openPanelInExplore(cell.element, spec);
                                          }
                                        }}
                                        tooltip={t('notebooks.cell.explore', 'Open in Explore')}
                                      />
                                    </>
                                  ) : undefined
                                }
                              >
                                {cell.collapsed ? (
                                  <CollapsedCellSummary
                                    cell={cell}
                                    onExpand={() => update((s) => setCellCollapsed(s, index, false))}
                                  />
                                ) : (
                                  <NotebookCellBody
                                    cell={cell}
                                    spec={spec}
                                    index={index}
                                    editing={editingCellKey === cell.elementName}
                                    renaming={renamingKey === cell.elementName}
                                    timeEditing={timeEditKey === cell.elementName}
                                    refreshNonce={refreshNonce}
                                    onStartEdit={() => setEditingCellKey(cell.elementName)}
                                    onDoneEdit={() => setEditingCellKey(null)}
                                    onDoneRename={() => setRenamingKey(null)}
                                    onDoneTimeEdit={() => setTimeEditKey(null)}
                                    onRegisterDataReader={(getData) =>
                                      dataReaders.current.set(cell.elementName, getData)
                                    }
                                    update={update}
                                  />
                                )}
                              </CellFrame>
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

          {cells.length > 0 && (
            <AddCellRow onAddText={() => insertTextAt(cells.length)} onAddCode={() => insertCodeAt(cells.length)} />
          )}
        </div>

        <ConfirmModal
          isOpen={confirmDelete}
          title={t('notebooks.editor.delete-title', 'Delete notebook')}
          body={t('notebooks.editor.delete-body', 'Are you sure you want to delete "{{title}}"?', {
            title: spec.title,
          })}
          confirmText={t('notebooks.editor.delete-confirm', 'Delete')}
          onConfirm={async () => {
            await deleteNotebook(uid);
            locationService.push('/notebooks');
          }}
          onDismiss={() => setConfirmDelete(false)}
        />
      </Page.Contents>
    </Page>
  );
}

interface CellBodyProps {
  cell: ResolvedCell;
  spec: NotebookSpec;
  index: number;
  editing: boolean;
  renaming: boolean;
  timeEditing: boolean;
  refreshNonce: number;
  onStartEdit: () => void;
  onDoneEdit: () => void;
  onDoneRename: () => void;
  onDoneTimeEdit: () => void;
  onRegisterDataReader: (getData: () => PanelData | undefined) => void;
  update: (mutate: (spec: NotebookSpec) => NotebookSpec, activity?: { label: string; cellKey?: string }) => void;
}

function NotebookCellBody({
  cell,
  spec,
  index,
  editing,
  renaming,
  timeEditing,
  refreshNonce,
  onStartEdit,
  onDoneEdit,
  onDoneRename,
  onDoneTimeEdit,
  onRegisterDataReader,
  update,
}: CellBodyProps) {
  const { element, elementName } = cell;

  if (element.kind === 'Panel') {
    const commitRename = (value: string) => {
      update((s) => updatePanelTitle(s, elementName, value), {
        label: t('notebooks.activity.renamed-panel', 'renamed a panel'),
        cellKey: elementName,
      });
      onDoneRename();
    };

    const isLocked = Boolean(cell.timeFrom && cell.timeTo);
    const effectiveFrom = cell.timeFrom ?? spec.timeSettings.from;
    const effectiveTo = cell.timeTo ?? spec.timeSettings.to;

    return (
      <>
        {renaming && (
          <Input
            autoFocus
            defaultValue={element.spec.title}
            aria-label={t('notebooks.cell.rename-label', 'Panel title')}
            onBlur={(e) => commitRename(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                commitRename(e.currentTarget.value);
              }
              if (e.key === 'Escape') {
                onDoneTimeEdit();
                onDoneRename();
              }
            }}
          />
        )}
        {timeEditing && (
          <Stack direction="row" gap={1} alignItems="center">
            <TimeRangeInput
              value={rangeUtil.convertRawToRange({ from: effectiveFrom, to: effectiveTo })}
              onChange={(tr) => {
                update((s) => setCellTimeOverride(s, index, rawToString(tr.raw.from), rawToString(tr.raw.to)), {
                  label: t('notebooks.activity.locked-time', 'locked a block to a time range'),
                  cellKey: elementName,
                });
                onDoneTimeEdit();
              }}
            />
            <Button
              size="sm"
              variant="secondary"
              fill="outline"
              onClick={() => {
                update((s) => clearCellTimeOverride(s, index));
                onDoneTimeEdit();
              }}
            >
              <Trans i18nKey="notebooks.cell.time-sync">Use notebook time</Trans>
            </Button>
            <IconButton name="times" tooltip={t('notebooks.cell.time-close', 'Close')} onClick={onDoneTimeEdit} />
          </Stack>
        )}
        {isLocked && !timeEditing && (
          <Stack direction="row" gap={0.5} alignItems="center">
            <Icon name="lock" size="xs" />
            <Text variant="bodySmall" color="secondary">
              {t('notebooks.cell.locked-range', 'Locked: {{range}}', {
                range: formatLockedRange(cell.timeFrom!, cell.timeTo!),
              })}
            </Text>
            <IconButton
              name="times"
              size="sm"
              tooltip={t('notebooks.cell.unlock', 'Sync back to notebook time range')}
              onClick={() => update((s) => clearCellTimeOverride(s, index))}
            />
          </Stack>
        )}
        <PanelCellView
          panel={element}
          timeFrom={effectiveFrom}
          timeTo={effectiveTo}
          refreshNonce={refreshNonce}
          height={cell.height}
          onHeightChange={(height) => update((s) => setCellHeight(s, index, height))}
          onDataReaderReady={onRegisterDataReader}
        />
      </>
    );
  }

  if (element.kind === 'LibraryPanel') {
    return (
      <Alert
        severity="info"
        title={t('notebooks.editor.library-panel', 'Library panel — open the notebook view to render it')}
      />
    );
  }

  const content = element.spec.content;
  if (content.kind === 'Markdown') {
    return (
      <MarkdownCellEditor
        value={content.spec.text}
        editing={editing}
        onStartEdit={onStartEdit}
        onChange={(text) => update((s) => updateMarkdownText(s, elementName, text))}
        onDone={onDoneEdit}
      />
    );
  }

  return (
    <CodeCellEditor
      code={content.spec.code}
      language={content.spec.language}
      onChange={(changes) => update((s) => updateCodeCell(s, elementName, changes))}
    />
  );
}

function EmptyNotebook({ onAddText, onAddCode }: { onAddText: () => void; onAddCode: () => void }) {
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.empty} data-testid="notebook-empty-state">
      <Text element="h3" variant="h4">
        <Trans i18nKey="notebooks.editor.empty-title">Start your investigation</Trans>
      </Text>
      <Text color="secondary">
        <Trans i18nKey="notebooks.editor.empty-body">
          Write down what you are seeing, then bring in live data — any dashboard panel or Explore query can be added
          straight into this notebook.
        </Trans>
      </Text>
      <Stack direction="row" gap={1} wrap="wrap" justifyContent="center">
        <Button icon="text-fields" onClick={onAddText}>
          <Trans i18nKey="notebooks.editor.empty-add-text">Add text</Trans>
        </Button>
        <Button variant="secondary" icon="brackets-curly" onClick={onAddCode}>
          <Trans i18nKey="notebooks.editor.empty-add-code">Add code</Trans>
        </Button>
        <LinkButton variant="secondary" icon="apps" href="/dashboards">
          <Trans i18nKey="notebooks.editor.empty-dashboards">Browse dashboards</Trans>
        </LinkButton>
        <LinkButton variant="secondary" icon="compass" href="/explore">
          <Trans i18nKey="notebooks.editor.empty-explore">Open Explore</Trans>
        </LinkButton>
      </Stack>
    </div>
  );
}

// With no explicit Save button (the editor autosaves), this line is the save UI —
// it must always show a definite state so users trust edits are persisted.
function saveStatusText(saving: boolean, dirty: boolean, lastSavedAt?: number): string {
  if (saving) {
    return t('notebooks.editor.status-saving', 'Saving…');
  }
  if (dirty) {
    return t('notebooks.editor.status-pending', 'Saving shortly…');
  }
  if (lastSavedAt) {
    return t('notebooks.editor.status-saved', 'Saved {{when}}', { when: dateTimeFormatTimeAgo(lastSavedAt) });
  }
  return t('notebooks.editor.status-clean', 'All changes saved');
}

function rawToString(value: RawTimeRange['from']): string {
  return typeof value === 'string' ? value : value.toISOString();
}

/** Locked ranges are usually absolute timestamps; show them in a readable local format. */
function formatLockedRange(from: string, to: string): string {
  const range = rangeUtil.convertRawToRange({ from, to });
  if (rangeUtil.isRelativeTimeRange({ from, to })) {
    return `${from} → ${to}`;
  }
  return `${range.from.format('MMM D, HH:mm')} → ${range.to.format('HH:mm')}`;
}

const getStyles = (theme: GrafanaTheme2) => ({
  document: css({
    position: 'relative',
    maxWidth: 900,
    margin: '0 auto',
    width: '100%',
    paddingBottom: theme.spacing(8),
  }),
  metaRow: css({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing(2),
    marginBottom: theme.spacing(2),
    paddingBottom: theme.spacing(2),
    borderBottom: `1px solid ${theme.colors.border.weak}`,
  }),
  followingPill: css({
    position: 'fixed',
    top: theme.spacing(10),
    left: '50%',
    transform: 'translateX(-50%)',
    zIndex: theme.zIndex.portal,
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(0.75),
    color: '#fff',
    padding: theme.spacing(0.5, 0.75, 0.5, 1.5),
    borderRadius: theme.shape.radius.pill,
    boxShadow: theme.shadows.z3,
    fontWeight: theme.typography.fontWeightMedium,
  }),
  titleInput: css({
    border: 'none',
    outline: 'none',
    background: 'transparent',
    width: '100%',
    fontSize: theme.typography.h1.fontSize,
    fontWeight: theme.typography.h1.fontWeight,
    lineHeight: theme.typography.h1.lineHeight,
    color: theme.colors.text.primary,
    padding: 0,

    '&::placeholder': {
      color: theme.colors.text.disabled,
    },
    '&:focus-visible': {
      outline: `2px solid ${theme.colors.primary.border}`,
      outlineOffset: 4,
      borderRadius: theme.shape.radius.default,
    },
  }),
  cells: css({
    display: 'flex',
    flexDirection: 'column',
  }),
  empty: css({
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: theme.spacing(2),
    textAlign: 'center',
    padding: theme.spacing(8, 2),
    border: `1px dashed ${theme.colors.border.medium}`,
    borderRadius: theme.shape.radius.default,
  }),
});
