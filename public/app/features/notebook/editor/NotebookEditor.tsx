import { css } from '@emotion/css';
import { DragDropContext, Draggable, Droppable, type DropResult } from '@hello-pangea/dnd';
import { useCallback, useEffect, useRef, useState } from 'react';

import {
  AppEvents,
  dateTimeFormatTimeAgo,
  rangeUtil,
  toUtc,
  type DataSourceInstanceSettings,
  type GrafanaTheme2,
  type PanelData,
} from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { locationService } from '@grafana/runtime';
import { type PanelKind, type Spec as NotebookSpec } from '@grafana/schema/apis/notebook/v2beta1';
import {
  Alert,
  Button,
  ConfirmModal,
  Dropdown,
  IconButton,
  LinkButton,
  Menu,
  RefreshPicker,
  Stack,
  TagsInput,
  Text,
  TimeRangePicker,
  useStyles2,
} from '@grafana/ui';
import { appEvents } from 'app/core/app_events';
import { Page } from 'app/core/components/Page/Page';
import PageLoader from 'app/core/components/PageLoader/PageLoader';
import { createSuccessNotification } from 'app/core/copy/appNotification';
import { notifyApp } from 'app/core/reducers/appNotification';
import { copyStringToClipboard } from 'app/core/utils/explore';
import { getShiftedTimeRange, getZoomedTimeRange } from 'app/core/utils/timePicker';
import { dispatch } from 'app/store/store';

import { deleteNotebook, duplicateNotebook, notebookEditUrl, notebookViewUrl } from '../api/notebookAPI';
import { setLastUsedNotebook } from '../model/lastUsedNotebook';
import { consumeNewNotebook } from '../model/newNotebookSignal';
import {
  DEFAULT_NOTEBOOK_TITLE,
  duplicateCellAt,
  insertElement,
  moveCell,
  newCodeElement,
  newMarkdownElement,
  newPanelForDatasource,
  removeCellAt,
  resolveCells,
  setNotebookTimeRange,
  setNotebookTitle,
  updatePanelViz,
} from '../model/notebookSpec';
import { notebookToMarkdown } from '../model/notebookToMarkdown';
import { rawToString } from '../model/timeFormat';

import { AddCellRow } from './AddCellRow';
import { InsertCellDivider } from './InsertCellDivider';
import { NotebookCellBody } from './NotebookCellBody';
import { CellFrame } from './cells/CellFrame';
import { getExploreUrlForPanel } from './cells/PanelCellView';
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
  const [renamingKey, setRenamingKey] = useState<string | null>(null);
  const [timeEditKey, setTimeEditKey] = useState<string | null>(null);
  const [queryEditKey, setQueryEditKey] = useState<string | null>(null);
  const [highlightKey, setHighlightKey] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [refreshNonce, setRefreshNonce] = useState(0);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const highlightTimer = useRef<ReturnType<typeof setTimeout>>();
  // Latest query-result readers per panel cell, powering the viz suggestions previews.
  const dataReaders = useRef(new Map<string, () => PanelData | undefined>());
  // Panels added in-editor whose viz is still the pre-data default: their first
  // results auto-pick the visualization the data prefers (frame metadata). Cleared
  // by the first arrival or any manual viz choice.
  const autoVizCells = useRef(new Set<string>());
  // Panels whose viz the user picked explicitly — auto-pick never touches these.
  const manualVizCells = useRef(new Set<string>());

  // Opening a notebook makes it the target of the "Add to last notebook" quick actions.
  const loadedTitle = !loading && !loadError ? spec?.title : undefined;
  useEffect(() => {
    if (loadedTitle !== undefined) {
      setLastUsedNotebook(uid, loadedTitle);
    }
  }, [uid, loadedTitle]);

  const update = useCallback(
    (mutate: Parameters<typeof editor.updateSpec>[0]) => {
      editor.updateSpec(mutate);
    },
    [editor]
  );

  const undo = useCallback(() => {
    editor.undo();
  }, [editor]);

  const redo = useCallback(() => {
    editor.redo();
  }, [editor]);

  const jumpToCell = useCallback((cellKey: string) => {
    document.querySelector(`[data-cell-key="${CSS.escape(cellKey)}"]`)?.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
    });
    setHighlightKey(cellKey);
    clearTimeout(highlightTimer.current);
    highlightTimer.current = setTimeout(() => setHighlightKey(null), 2500);
  }, []);

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
      }
    },
    [update]
  );

  const insertCodeAt = useCallback(
    (index: number) => {
      update((s) => {
        const result = insertElement(s, newCodeElement('', ''), { index });
        return result.spec;
      });
    },
    [update]
  );

  const insertVizAt = useCallback(
    (index: number, ds: DataSourceInstanceSettings) => {
      // The testdata datasource gets a scenario so the new panel renders data immediately.
      const isTestdata = ds.type === 'grafana-testdata-datasource';
      const querySpec = isTestdata ? { scenarioId: 'random_walk' } : {};
      let newKey: string | undefined;
      update((s) => {
        const result = insertElement(
          s,
          newPanelForDatasource({ uid: ds.uid, type: ds.type }, { title: ds.name, querySpec }),
          {
            index,
          }
        );
        newKey = result.elementName;
        return result.spec;
      });
      if (newKey) {
        jumpToCell(newKey);
        autoVizCells.current.add(newKey);
        // A panel with an empty query renders "no data" — open the query editor
        // right away so the next step is obvious. Testdata already shows data.
        if (!isTestdata) {
          setQueryEditKey(newKey);
        }
      }
    },
    [update, jumpToCell]
  );

  // First data for a freshly added panel: adopt the viz the frames prefer, unless
  // the user already picked one themselves.
  const onPreferredViz = useCallback(
    (elementName: string, pluginId: string) => {
      if (!autoVizCells.current.has(elementName)) {
        return;
      }
      autoVizCells.current.delete(elementName);
      const element = editor.getSpec()?.elements[elementName];
      if (element?.kind !== 'Panel' || element.spec.vizConfig.group === pluginId) {
        return;
      }
      update((s) => updatePanelViz(s, elementName, { pluginId }));
    },
    [editor, update]
  );

  const onDragEnd = useCallback(
    (result: DropResult) => {
      if (result.destination && result.destination.index !== result.source.index) {
        update((s) => moveCell(s, result.source.index, result.destination!.index));
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

  // Freshly created notebooks start with the title focused and selected, so typing
  // immediately focuses the title for rename.
  const isLoaded = !loading && !!spec;
  useEffect(() => {
    if (!isLoaded) {
      return;
    }
    const isNew = consumeNewNotebook(uid) || new URLSearchParams(locationService.getLocation().search).has('new');
    if (!isNew) {
      return;
    }
    locationService.partial({ new: null }, true);
    // The app chrome moves focus for a11y shortly after navigation, so a single
    // focus() loses the race — retry briefly until the title actually holds focus.
    let cancelled = false;
    let attempts = 0;
    const tryFocus = () => {
      if (cancelled) {
        return;
      }
      const input = titleInputRef.current;
      if (input && document.activeElement !== input) {
        input.focus();
        input.select();
      }
      if (document.activeElement !== titleInputRef.current && attempts++ < 15) {
        setTimeout(tryFocus, 150);
      }
    };
    requestAnimationFrame(tryFocus);
    return () => {
      cancelled = true;
    };
  }, [isLoaded, uid]);

  // Scroll to and briefly highlight a cell linked via ?cell= (used by "Add & open notebook").
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
    text: spec?.title || t('notebooks.editor.untitled', DEFAULT_NOTEBOOK_TITLE),
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

  const commitTimeRange = (from: string, to: string) => update((s) => setNotebookTimeRange(s, from, to));
  const shiftTimeRange = (direction: number) => {
    const shifted = getShiftedTimeRange(direction, timeRange);
    commitTimeRange(toUtc(shifted.from).toISOString(), toUtc(shifted.to).toISOString());
  };
  const zoomTimeRange = (factor: number) => {
    const zoomed = getZoomedTimeRange(timeRange, factor);
    commitTimeRange(toUtc(zoomed.from).toISOString(), toUtc(zoomed.to).toISOString());
  };

  const moreMenu = (
    <Menu>
      <Menu.Item
        icon="link"
        label={t('notebooks.editor.copy-link', 'Copy link')}
        onClick={() => {
          copyStringToClipboard(new URL(notebookViewUrl(uid), window.location.origin).toString());
          appEvents.emit(AppEvents.alertSuccess, [t('notebooks.editor.link-copied', 'Notebook link copied')]);
        }}
      />
      <Menu.Item icon="copy" label={t('notebooks.editor.copy-markdown', 'Copy as Markdown')} onClick={onCopyMarkdown} />
      <Menu.Item
        icon="file-copy-alt"
        label={t('notebooks.editor.duplicate', 'Duplicate notebook')}
        onClick={async () => {
          const current = editor.getSpec();
          if (!current) {
            return;
          }
          const created = await duplicateNotebook(
            current,
            t('notebooks.list.copy-title', '{{title}} (copy)', { title: current.title })
          );
          locationService.push(notebookEditUrl(created.metadata.name));
        }}
      />
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
      <IconButton
        name="history"
        size="lg"
        disabled={!editor.state.canUndo}
        onClick={undo}
        tooltip={t('notebooks.editor.undo', 'Undo (⌘Z)')}
      />
      {/* No mirrored circular-arrow icon exists in the icon set; flip the undo glyph. */}
      <IconButton
        name="history"
        size="lg"
        className={styles.redoIcon}
        disabled={!editor.state.canRedo}
        onClick={redo}
        tooltip={t('notebooks.editor.redo', 'Redo (⇧⌘Z)')}
      />
      {/* The dashboards-style picker: its popup is right-edge aligned (TimeRangeInput's
          overflows the viewport from a right-anchored toolbar) and it brings the
          shift/zoom arrows Grafana users expect. */}
      <TimeRangePicker
        value={timeRange}
        onChange={(tr) => commitTimeRange(rawToString(tr.raw.from), rawToString(tr.raw.to))}
        onChangeTimeZone={() => {}}
        onMoveBackward={() => shiftTimeRange(-1)}
        onMoveForward={() => shiftTimeRange(1)}
        onZoom={() => zoomTimeRange(2)}
      />
      <RefreshPicker
        value={spec.timeSettings.autoRefresh}
        intervals={spec.timeSettings.autoRefreshIntervals}
        onRefresh={() => setRefreshNonce((n) => n + 1)}
        onIntervalChanged={(interval) =>
          update((s) => ({ ...s, timeSettings: { ...s.timeSettings, autoRefresh: interval } }))
        }
      />
      <LinkButton variant="primary" href={notebookViewUrl(uid)} icon="book-open">
        <Trans i18nKey="notebooks.editor.view">View</Trans>
      </LinkButton>
      <Dropdown overlay={moreMenu} placement="bottom-end">
        <IconButton name="ellipsis-v" tooltip={t('notebooks.editor.more', 'More actions')} size="lg" />
      </Dropdown>
    </Stack>
  );

  const titleInput = (
    <input
      ref={titleInputRef}
      className={styles.titleInput}
      value={spec.title}
      placeholder={t('notebooks.editor.title-placeholder', 'Give this notebook a title')}
      onChange={(e) => update((s) => setNotebookTitle(s, e.currentTarget.value))}
      // Fresh notebooks carry a placeholder-ish title; selecting it on focus means
      // typing replaces it instead of appending to it.
      onFocus={(e) => e.currentTarget.select()}
      aria-label={t('notebooks.editor.title-label', 'Notebook title')}
      data-testid="notebook-title-input"
    />
  );

  return (
    <Page navId="notebooks" pageNav={pageNav} renderTitle={() => titleInput} actions={actions}>
      <Page.Contents>
        <div className={styles.document}>
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
            <EmptyNotebook />
          ) : (
            <DragDropContext onDragEnd={onDragEnd}>
              <Droppable droppableId="notebook-cells">
                {(droppable) => (
                  <div ref={droppable.innerRef} {...droppable.droppableProps} className={styles.cells}>
                    {cells.map((cell, index) => {
                      return (
                        <Draggable draggableId={cell.elementName} index={index} key={cell.elementName}>
                          {(draggable, snapshot) => (
                            <div
                              ref={draggable.innerRef}
                              {...draggable.draggableProps}
                              onFocusCapture={() => setEditingCellKey(cell.elementName)}
                              onBlurCapture={(e) => {
                                // Focus moving between controls inside the same cell (e.g. code
                                // editor → its language picker) is not "done editing".
                                if (e.relatedTarget instanceof Node && e.currentTarget.contains(e.relatedTarget)) {
                                  return;
                                }
                                setEditingCellKey((cur) => (cur === cell.elementName ? null : cur));
                              }}
                            >
                              <InsertCellDivider
                                onInsertText={() => insertTextAt(index)}
                                onInsertCode={() => insertCodeAt(index)}
                                onInsertViz={(ds) => insertVizAt(index, ds)}
                              />
                              <CellFrame
                                cellKey={cell.elementName}
                                source={cell.source}
                                peers={[]}
                                highlighted={highlightKey === cell.elementName}
                                isDragging={snapshot.isDragging}
                                dragHandleProps={draggable.dragHandleProps}
                                onDuplicate={() => update((s) => duplicateCellAt(s, index))}
                                onDelete={() => {
                                  update((s) => removeCellAt(s, index));
                                  dispatch(
                                    notifyApp(
                                      createSuccessNotification(
                                        t('notebooks.editor.block-deleted', 'Block deleted'),
                                        undefined,
                                        undefined,
                                        <Button variant="secondary" size="sm" onClick={undo}>
                                          <Trans i18nKey="notebooks.editor.undo-delete">Undo</Trans>
                                        </Button>
                                      )
                                    )
                                  );
                                }}
                                extraActions={
                                  cell.element.kind === 'Panel' ? (
                                    <>
                                      <IconButton
                                        name="database"
                                        size="sm"
                                        onClick={() =>
                                          setQueryEditKey((cur) => (cur === cell.elementName ? null : cell.elementName))
                                        }
                                        tooltip={t('notebooks.cell.edit-query', 'Edit query')}
                                      />
                                      <VizSuggestionsButton
                                        currentPluginId={cell.element.spec.vizConfig.group}
                                        getData={() => dataReaders.current.get(cell.elementName)?.()}
                                        onSelect={(suggestion) => {
                                          // A manual choice always wins over data-driven auto-pick.
                                          autoVizCells.current.delete(cell.elementName);
                                          manualVizCells.current.add(cell.elementName);
                                          update((s) => updatePanelViz(s, cell.elementName, suggestion));
                                        }}
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
                                <NotebookCellBody
                                  cell={cell}
                                  spec={spec}
                                  index={index}
                                  editing={editingCellKey === cell.elementName}
                                  renaming={renamingKey === cell.elementName}
                                  timeEditing={timeEditKey === cell.elementName}
                                  queryEditing={queryEditKey === cell.elementName}
                                  refreshNonce={refreshNonce}
                                  onStartEdit={() => setEditingCellKey(cell.elementName)}
                                  onDoneEdit={() => setEditingCellKey(null)}
                                  onDoneRename={() => setRenamingKey(null)}
                                  onDoneTimeEdit={() => setTimeEditKey(null)}
                                  onDoneQueryEdit={() => setQueryEditKey(null)}
                                  getPanelData={() => dataReaders.current.get(cell.elementName)?.()}
                                  onRegisterDataReader={(getData) => dataReaders.current.set(cell.elementName, getData)}
                                  onPreferredViz={(pluginId) => onPreferredViz(cell.elementName, pluginId)}
                                  onQueryApplied={() => {
                                    // A new query means a possibly new data shape (e.g. no time
                                    // field → table); re-arm auto-pick unless the viz was chosen
                                    // manually.
                                    if (!manualVizCells.current.has(cell.elementName)) {
                                      autoVizCells.current.add(cell.elementName);
                                    }
                                  }}
                                  update={update}
                                />
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

          <AddCellRow
            onAddText={() => insertTextAt(cells.length)}
            onAddCode={() => insertCodeAt(cells.length)}
            onAddViz={(ds) => insertVizAt(cells.length, ds)}
          />
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

function EmptyNotebook() {
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.empty} data-testid="notebook-empty-state">
      <Text element="h3" variant="h4">
        <Trans i18nKey="notebooks.editor.empty-title">Start your investigation</Trans>
      </Text>
      <Text color="secondary">
        <Trans i18nKey="notebooks.editor.empty-body">
          Write down what you are seeing, then bring in live data — add a visualization below, or capture any dashboard
          panel or Explore query with “Add to notebook”.
        </Trans>
      </Text>
      <Stack direction="row" gap={1} wrap="wrap" justifyContent="center">
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
  redoIcon: css({
    transform: 'scaleX(-1)',
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
