import { css, cx } from '@emotion/css';
import { DragDropContext, Droppable, type DragStart, type DragUpdate, type DropResult } from '@hello-pangea/dnd';
import { isEqual } from 'lodash';
import { useCallback, useEffect, useRef, useState } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import {
  sceneGraph,
  SceneObjectBase,
  VizPanel,
  type SceneComponentProps,
  type SceneObject,
  type SceneObjectState,
  type SceneQueryRunner,
} from '@grafana/scenes';
import { type DataQuery } from '@grafana/schema';
import { useStyles2 } from '@grafana/ui';
import { appEvents } from 'app/core/app_events';
import { type DashboardLayoutManager } from 'app/features/dashboard-scene/scene/types/DashboardLayoutManager';
import { type LayoutRegistryItem } from 'app/features/dashboard-scene/scene/types/LayoutRegistryItem';
import { buildVizPanelState } from 'app/features/dashboard-scene/serialization/layoutSerializers/utils';
import { dashboardSceneGraph, type PanelIdGenerator } from 'app/features/dashboard-scene/utils/dashboardSceneGraph';
import { getQueryRunnerFor, getVizPanelKeyForPanelId } from 'app/features/dashboard-scene/utils/utils';
import { ShowConfirmModalEvent } from 'app/types/events';

import {
  type CellContentKind,
  defaultCodeCellContentKind,
  defaultMarkdownCellContentKind,
  defaultVisualizationPanelKind,
  type NotebookLayoutItemKind,
  type NotebookLayoutKind,
} from '../../types';
import { type NotebookEditAction, type NotebookEditHistory } from '../NotebookEditHistory';
import { isNotebookScene } from '../isNotebookScene';

import { NotebookCellItem } from './NotebookCellItem';
import { NotebookDocumentHeader } from './NotebookDocumentHeader';
import { NotebookAddBlockDivider } from './edit/NotebookAddBlockDivider';
import { type NotebookBlockType } from './edit/NotebookBlockTypeMenu';
import { getCellDropIndicator, NotebookCellFrame, type NotebookDragState } from './edit/NotebookCellFrame';
import { setQueryRunnerQueries } from './setQueryRunnerQueries';

interface NotebookLayoutManagerState extends SceneObjectState {
  cells: NotebookCellItem[];
  // Seeded by the notebook loader from the same spec fields as NotebookScene, so the document
  // header renders without reaching up to the parent. Read them off the scene once editing lands,
  // or the two copies drift.
  title?: string;
  tags?: string[];
  /**
   * Mirrors the scene's edit mode, pushed down by editModeChanged rather than read off the parent:
   * reaching up to the notebook scene pulls the dashboard-scene module graph into the layout and
   * reintroduces the dependency cycle.
   */
  isEditing?: boolean;
}

// Keep typing useful to undo without storing every keystroke as a separate action.
const CONTENT_EDIT_COALESCE_MS = 800;

interface PendingContentEdit {
  elementName: string;
  before: CellContentKind;
  after: CellContentKind;
  action: NotebookEditAction;
  timer?: ReturnType<typeof setTimeout>;
}

// Query text edits coalesce the same way content typing does — see setCellQueries. Scoped by cell
// identity rather than elementName: unlike narrative content, no two cells ever share one query
// runner, so there's no sibling-fanout step to mirror from applyCellContent.
interface PendingQueriesEdit {
  cell: NotebookCellItem;
  runner: SceneQueryRunner;
  before: DataQuery[];
  after: DataQuery[];
  action: NotebookEditAction;
  timer?: ReturnType<typeof setTimeout>;
}

export class NotebookLayoutManager
  extends SceneObjectBase<NotebookLayoutManagerState>
  implements DashboardLayoutManager<{}, NotebookLayoutKind>
{
  public static Component = NotebookLayoutManagerRenderer;
  public readonly isDashboardLayoutManager = true;
  // Lets a cell find the manager that owns it without importing this class — see
  // isNotebookLayoutManager for why that import direction has to stay closed.
  public readonly isNotebookLayoutManager = true;

  public static readonly descriptor: LayoutRegistryItem = {
    get name() {
      return t('dashboard.notebook-layout.name', 'Notebook');
    },
    get description() {
      return t('dashboard.notebook-layout.description', 'A vertical sequence of panels, text, and code cells');
    },
    id: 'NotebookLayout',
    createFromLayout: NotebookLayoutManager.createFromLayout,
    isGridLayout: false,
    icon: 'list-ul',
  };

  public readonly descriptor = NotebookLayoutManager.descriptor;

  private pendingContentEdit?: PendingContentEdit;
  private pendingQueriesEdit?: PendingQueriesEdit;

  public constructor(state: NotebookLayoutManagerState) {
    super(state);

    // Typing is grouped into one undo step that sits in a field until the typing stops. Without this,
    // closing the notebook mid-word would leave that step behind, and the next typing would join it.
    this.addActivationHandler(() => {
      return () => this.commitPendingEdits();
    });
  }

  /**
   * The scene above owns the history, so reading it here means nothing has to hand it over again when
   * the scene swaps its body. Editing a manager with no scene above it still works, the changes are
   * just not recorded.
   */
  private get editHistory(): NotebookEditHistory | undefined {
    return this.notebookScene?.editHistory;
  }

  /**
   * The scene owns the tags - it is what the save model reads - so the header's edits are forwarded up
   * to it rather than applied here. A notebook rendered without a scene above it silently keeps its
   * tags read-only.
   */
  public setTagsFromHeader(tags: string[]): void {
    this.notebookScene?.onTagsChange(tags);
  }

  /**
   * Walked rather than imported: taking NotebookScene as a value would have this file and that one
   * import each other, which is the cycle this layout is arranged to avoid - hence the brand check.
   *
   * Undefined is a real answer, not a failure. duplicate(), the deserializer and this class's own
   * tests all build a manager with no scene above it, and both readers below treat that as "nothing
   * to tell" rather than an error.
   */
  private get notebookScene() {
    let parent = this.parent;

    while (parent) {
      if (isNotebookScene(parent)) {
        return parent;
      }
      parent = parent.parent;
    }

    return undefined;
  }

  // Serialization lives here instead of in a helper file, so that this file never has to import the
  // serializer. If both files imported each other they would form a cycle, which is what this layout
  // avoids. The serializer still imports this class to build it when reading a notebook, one way only.
  public serialize(): NotebookLayoutKind {
    const cells: NotebookLayoutItemKind[] = this.state.cells.map((cell) => ({
      kind: 'NotebookLayoutItem',
      spec: {
        element: { kind: 'ElementReference', name: cell.state.elementName },
        source: cell.state.source,
        // Only write `collapsed` when it has a value, so a notebook that never had it does not gain it.
        ...(cell.state.collapsed !== undefined ? { collapsed: cell.state.collapsed } : {}),
      },
    }));

    return { kind: 'NotebookLayout', spec: { cells } };
  }

  // Only panel cells hold a viz panel. Text and code cells are just content, and the rest of the
  // scene (the query runner, the edit tools) is meant not to see them.
  public getVizPanels(): VizPanel[] {
    return this.state.cells.map((cell) => cell.state.body).filter((body): body is VizPanel => body !== undefined);
  }

  /**
   * The scene calls this when the mode flips. Recording it here rather than reaching up to the
   * NotebookScene keeps the import one-directional — the scene only type-imports this manager.
   */
  public editModeChanged(isEditing: boolean): void {
    this.setState({ isEditing });
  }

  /** Refreshes the header's copy of the tags. NotebookScene owns them and pushes on every change. */
  public setTags(tags: string[] | undefined): void {
    this.setState({ tags });
  }

  /**
   * Applies narrative content to every cell referencing the same element.
   *
   * Two layout items may legally reference one element, and the deserializer gives each its own
   * cell — two views of one thing. serialize() collapses them back into a single elements[name]
   * entry where the last cell processed wins, so updating only the edited cell loses the edit
   * outright whenever an unedited duplicate follows it.
   *
   * It lives on the manager because that is what owns `cells`; a cell cannot see its siblings.
   *
   * Also maintains the "always one more empty block ready" invariant: the moment the trailing cell —
   * and only the trailing cell — stops being empty, a fresh empty one takes its place at the tail, so
   * the reader never has to explicitly ask for the next block just to keep typing. Gated on the
   * *transition* (was empty, now isn't), not merely "is non-empty", so this doesn't append again on
   * every subsequent keystroke into what is now a real, settled cell — checked once here, against the
   * state from before this specific edit, rather than inside applyCellContent below, which also runs
   * on every coalesced keystroke of the same edit and on undo/redo replay.
   */
  public setCellContent = (target: NotebookCellItem, content: CellContentKind): void => {
    const previous = target.state.content;
    if (!previous || isEqual(previous, content)) {
      return;
    }

    const wasEmpty = isEmptyMarkdown(previous);
    const index = this.state.cells.indexOf(target);

    const pending = this.pendingContentEdit;
    if (pending?.elementName === target.state.elementName) {
      this.extendContentEdit(pending, content);
    } else {
      this.commitContentEdits();
      this.startContentEdit(target.state.elementName, previous, content);
    }

    if (wasEmpty && !isEmptyMarkdown(content) && index === this.state.cells.length - 1) {
      this.appendSystemCell(this.state.cells.length);
    }
  };

  /**
   * Adds a change to the edit already being typed, so a run of key presses is one undo step.
   *
   * Typing back to where the edit started leaves nothing to undo, so the action is taken off the
   * history rather than left there doing nothing.
   */
  private extendContentEdit(edit: PendingContentEdit, content: CellContentKind): void {
    this.applyCellContent(edit.elementName, content);
    edit.after = structuredClone(content);

    if (isEqual(edit.before, edit.after)) {
      this.editHistory?.discard(edit.action);
      this.finishContentEdit(edit);
      return;
    }

    this.scheduleContentEditCommit(edit);
  }

  private startContentEdit(elementName: string, previous: CellContentKind, content: CellContentKind): void {
    const after = structuredClone(content);
    const history = this.editHistory;
    if (!history) {
      this.applyCellContent(elementName, after);
      return;
    }

    // perform and undo read `edit` when they run, not now: extendContentEdit keeps changing `after`
    // while typing continues, and the last value is the one to redo. Both stop the grouping first, so
    // undoing while typing also ends the edit it undoes.
    const edit: PendingContentEdit = {
      elementName,
      before: structuredClone(previous),
      after,
      action: {
        label: t('notebooks.history.edit-block', 'Edit block'),
        perform: () => {
          this.finishContentEdit(edit);
          this.applyCellContent(edit.elementName, edit.after);
        },
        undo: () => {
          this.finishContentEdit(edit);
          this.applyCellContent(edit.elementName, edit.before);
        },
      },
    };

    this.pendingContentEdit = edit;
    this.applyCellContent(edit.elementName, edit.after);
    history.record(edit.action);
    this.scheduleContentEditCommit(edit);
  }

  public commitContentEdits(): void {
    if (this.pendingContentEdit) {
      this.finishContentEdit(this.pendingContentEdit);
    }
  }

  private scheduleContentEditCommit(edit: PendingContentEdit): void {
    clearTimeout(edit.timer);
    edit.timer = setTimeout(() => this.finishContentEdit(edit), CONTENT_EDIT_COALESCE_MS);
  }

  private finishContentEdit(edit: PendingContentEdit): void {
    clearTimeout(edit.timer);
    if (this.pendingContentEdit === edit) {
      this.pendingContentEdit = undefined;
    }
  }

  private applyCellContent(elementName: string, content: CellContentKind): void {
    for (const cell of this.state.cells) {
      // Panel cells carry no content and must not gain any.
      if (cell.state.content && cell.state.elementName === elementName) {
        cell.setState({ content });
      }
    }
  }

  private getQueryRunnerForCell(cell: NotebookCellItem): SceneQueryRunner | undefined {
    return getQueryRunnerFor(cell.state.body);
  }

  public setCellQueries = (cell: NotebookCellItem, queries: DataQuery[]): void => {
    const runner = this.getQueryRunnerForCell(cell);
    if (!runner || isEqual(runner.state.queries, queries)) {
      return;
    }

    const pending = this.pendingQueriesEdit;
    if (pending?.cell === cell) {
      this.extendQueriesEdit(pending, queries);
    } else {
      this.commitQueriesEdits();
      this.startQueriesEdit(cell, runner, runner.state.queries, queries);
    }
  };

  private extendQueriesEdit(edit: PendingQueriesEdit, queries: DataQuery[]): void {
    setQueryRunnerQueries(edit.runner, queries);
    edit.after = queries;

    if (isEqual(edit.before, edit.after)) {
      this.editHistory?.discard(edit.action);
      this.finishQueriesEdit(edit);
      return;
    }

    this.scheduleQueriesEditCommit(edit);
  }

  private startQueriesEdit(
    cell: NotebookCellItem,
    runner: SceneQueryRunner,
    before: DataQuery[],
    queries: DataQuery[]
  ): void {
    const history = this.editHistory;
    if (!history) {
      setQueryRunnerQueries(runner, queries);
      return;
    }

    // perform and undo read `edit` when they run, not now — see startContentEdit's own comment on why.
    const edit: PendingQueriesEdit = {
      cell,
      runner,
      before,
      after: queries,
      action: {
        label: t('notebooks.history.edit-query', 'Edit query'),
        perform: () => {
          this.finishQueriesEdit(edit);
          setQueryRunnerQueries(edit.runner, edit.after);
        },
        undo: () => {
          this.finishQueriesEdit(edit);
          setQueryRunnerQueries(edit.runner, edit.before);
        },
      },
    };

    this.pendingQueriesEdit = edit;
    setQueryRunnerQueries(runner, edit.after);
    history.record(edit.action);
    this.scheduleQueriesEditCommit(edit);
  }

  public commitQueriesEdits(): void {
    if (this.pendingQueriesEdit) {
      this.finishQueriesEdit(this.pendingQueriesEdit);
    }
  }

  private scheduleQueriesEditCommit(edit: PendingQueriesEdit): void {
    clearTimeout(edit.timer);
    edit.timer = setTimeout(() => this.finishQueriesEdit(edit), CONTENT_EDIT_COALESCE_MS);
  }

  private finishQueriesEdit(edit: PendingQueriesEdit): void {
    clearTimeout(edit.timer);
    if (this.pendingQueriesEdit === edit) {
      this.pendingQueriesEdit = undefined;
    }
  }

  /** Discrete, one-shot query-array mutation: add/remove/duplicate a row, or switch its datasource. */
  public runQueryEdit(cell: NotebookCellItem, label: string, queries: DataQuery[]): void {
    const runner = this.getQueryRunnerForCell(cell);
    if (!runner || isEqual(runner.state.queries, queries)) {
      return;
    }

    const before = runner.state.queries;
    this.executeEdit({
      label,
      perform: () => setQueryRunnerQueries(runner, queries),
      undo: () => setQueryRunnerQueries(runner, before),
    });
  }

  /**
   * Converts `cell`'s content to `type` in place — the trailing-slot markdown cell's "/" menu (see
   * NotebookCellRenderer) uses this rather than inserting a separate new cell the way the add-block
   * menu does, since the cell picking from that menu already exists and is already empty.
   *
   * Paragraph's starter content is already empty markdown, the same shape an unclaimed trailing
   * slot has. setCellContent treats that as a no-op, so without the check below the slot would
   * never be claimed and no replacement would appear — unlike Heading ("# ") or Code, whose
   * starter content actually differs. The "/" menu does not hit this: typing "/" has already
   * claimed the slot before convertCell runs.
   */
  public convertCell(cell: NotebookCellItem, type: NotebookBlockType): void {
    if (type === 'visualization') {
      this.convertCellToPanel(cell);
      return;
    }

    const content = contentForBlockType(type);
    if (!content) {
      return;
    }

    if (isEqual(cell.state.content, content)) {
      const index = this.state.cells.indexOf(cell);
      if (index !== -1 && index === this.state.cells.length - 1 && isEmptyMarkdown(content)) {
        this.appendSystemCell(this.state.cells.length);
      }
      return;
    }

    this.setCellContent(cell, content);
  }

  /**
   * Turns an existing narrative cell into a panel cell in place, for the "/" menu's Visualization pick
   * — addCell's own buildPanelCell builds the fresh-insert equivalent. Bypasses setCellContent's
   * content-diffing undo/coalescing machinery, which is built around comparing two CellContentKind
   * values and doesn't apply to a content -> body transition.
   */
  private convertCellToPanel(cell: NotebookCellItem): void {
    const previousContent = cell.state.content;
    const previousElementName = cell.state.elementName;
    const panel = this.buildVisualizationPanel();
    // A sibling cell may legally still reference previousElementName (see onContentChange); give the
    // converted cell a fresh one only then, so serialize() doesn't collapse both into one entry.
    const hasSharedName = this.state.cells.some(
      (other) => other !== cell && other.state.elementName === previousElementName
    );
    const elementName = hasSharedName ? this.nextElementName(previousElementName) : previousElementName;

    this.executeEdit({
      label: t('notebooks.history.add-block', 'Add block'),
      perform: () => cell.setElementBody(panel, elementName),
      undo: () => cell.setState({ body: undefined, content: previousContent, elementName: previousElementName }),
    });
  }

  /** A fresh, unconfigured Panel VizPanel — shared by buildCellFor (insert) and convertCellToPanel. */
  private buildVisualizationPanel(): VizPanel {
    const nextId = dashboardSceneGraph.getPanelIdGenerator(this);
    return new VizPanel(buildVizPanelState(defaultVisualizationPanelKind(), nextId()));
  }

  /**
   * Reorders a cell, mirroring RowsLayoutManager.moveRow. The cell objects move rather than being
   * rebuilt, so a panel cell keeps its VizPanel and its already-fetched data across the move.
   */
  public moveCell(fromIndex: number, toIndex: number) {
    const cell = this.state.cells[fromIndex];
    if (!cell || fromIndex === toIndex || toIndex < 0 || toIndex >= this.state.cells.length) {
      return;
    }

    this.executeEdit({
      label: t('notebooks.history.move-block', 'Move block'),
      perform: () => this.moveCellTo(cell, toIndex),
      undo: () => this.moveCellTo(cell, fromIndex),
    });
  }

  /**
   * Builds the cell a given block type inserts, and clamps `index` to the current cells length —
   * shared by `addCell` (a reader-initiated, undoable insert) and `appendSystemCell` (the "always one
   * more empty block ready" invariant's own automatic appends, which must stay off the undo stack:
   * they're bookkeeping the notebook performs on the reader's behalf, not a distinct action anyone
   * asked for).
   *
   * Visualization is the one block type that builds a `body` (a real Panel VizPanel) rather than
   * `content` — see buildVisualizationPanel and this file's own header comment on why a query-first
   * cell is a Panel element, not a bespoke content kind.
   */
  private buildCellFor(type: NotebookBlockType, index: number): { cell: NotebookCellItem; index: number } | undefined {
    const clampedIndex = Math.max(0, Math.min(index, this.state.cells.length));

    if (type === 'visualization') {
      const cell = new NotebookCellItem({
        elementName: this.nextElementName(type),
        source: 'user',
        body: this.buildVisualizationPanel(),
      });
      return { cell, index: clampedIndex };
    }

    const content = contentForBlockType(type);
    if (!content) {
      return undefined;
    }

    const cell = new NotebookCellItem({
      // A fresh name for the same reason duplicateCell needs one: serialize() writes it as the key into
      // the notebook's `elements` map, so reusing one would collapse the two cells into one element.
      elementName: this.nextElementName(type),
      // Everything the add-block menu inserts was asked for by a person, not proposed by the assistant.
      source: 'user',
      content,
    });

    return { cell, index: clampedIndex };
  }

  /**
   * Inserts a new cell at `index`, the position the add-block affordance was offering.
   *
   * Visualization stays inert rather than inserting a cell with no content kind behind it, which the
   * renderer would draw as a blank gap — the menu's "Coming soon" submenu is the only thing it offers.
   *
   * Returns the new cell so the caller can hand it the caret; undefined when nothing was inserted.
   */
  public addCell = (type: NotebookBlockType, index: number): NotebookCellItem | undefined => {
    // The divider below the trailing empty slot offers index === cells.length. Inserting *after*
    // that slot would leave it stranded mid-document once the invariant appends a replacement after
    // the new block. Inserting *before* it keeps the empty cell at the tail, and still goes through
    // executeEdit as "Add block" — convertCell would skip the undo stack for Paragraph (identical
    // empty markdown, so only appendSystemCell ran) and record Heading/Code as "Edit block".
    const trailing = this.state.cells.at(-1);
    if (index >= this.state.cells.length && trailing && isEmptyMarkdown(trailing.state.content)) {
      index = this.state.cells.length - 1;
    }

    const built = this.buildCellFor(type, index);
    if (!built) {
      return undefined;
    }

    this.executeEdit({
      label: t('notebooks.history.add-block', 'Add block'),
      perform: () => this.insertCell(built.cell, built.index),
      undo: () => this.removeCellInstance(built.cell),
    });

    return built.cell;
  };

  /**
   * The "always one more empty block ready" invariant's own way of appending a cell (see
   * setCellContent and the renderer's own bootstrap effect) — bypasses addCell's undo/redo recording
   * entirely, on purpose: this never runs from a reader-initiated action, so it must not show up as
   * something a reader can "undo" (nor sit on the same step as whatever edit triggered it).
   */
  public appendSystemCell(index: number): NotebookCellItem | undefined {
    const built = this.buildCellFor('paragraph', index);
    if (!built) {
      return undefined;
    }

    this.insertCell(built.cell, built.index);
    return built.cell;
  }

  /**
   * Inserts a copy of a cell directly below it.
   *
   * The copy needs a fresh element name, not the original's: serialize() writes those names as the keys
   * of the notebook's `elements` map, so two cells sharing one would collapse into a single element on
   * the next round-trip — the duplicate would silently become an alias rather than a copy. A panel cell
   * also needs a fresh panel key, for the same reasons duplicate() rekeys. Narrative content is cloned
   * rather than reused, so editing the copy cannot change the original.
   */
  public duplicateCell(cell: NotebookCellItem): void {
    const index = this.state.cells.indexOf(cell);
    if (index === -1) {
      return;
    }

    const nextId = dashboardSceneGraph.getPanelIdGenerator(this);
    const copy = cell.clone({
      key: undefined,
      elementName: this.nextElementName(`${cell.state.elementName}-copy`),
      body: cell.state.body?.clone({ key: getVizPanelKeyForPanelId(nextId()) }),
      ...(cell.state.content ? { content: structuredClone(cell.state.content) } : {}),
    });

    this.executeEdit({
      label: t('notebooks.history.duplicate-block', 'Duplicate block'),
      perform: () => this.insertCell(copy, index + 1),
      undo: () => this.removeCellInstance(copy),
    });
  }

  /**
   * Inserts a brand-new cell directly below `target`, with explicit content rather than a clone of an
   * existing one — Enter's own "split into a new block" gesture (see NotebookLayoutManagerRenderer's
   * onAdvance): the reader's cursor sits inside `target`, so the new block belongs immediately after
   * it, not wherever the document's own trailing empty cell happens to be. Defaults to an empty
   * paragraph when no content is given.
   *
   * Returns the new cell so the caller can hand it the caret; undefined when `target` isn't (or is no
   * longer) part of this notebook.
   */
  public insertCellAfter(target: NotebookCellItem, content?: CellContentKind): NotebookCellItem | undefined {
    const index = this.state.cells.indexOf(target);
    if (index === -1) {
      return undefined;
    }

    const cell = new NotebookCellItem({
      elementName: this.nextElementName('paragraph'),
      source: 'user',
      content: content ?? defaultMarkdownCellContentKind(),
    });

    this.executeEdit({
      label: t('notebooks.history.split-block', 'Split block'),
      perform: () => this.insertCell(cell, index + 1),
      undo: () => this.removeCellInstance(cell),
    });

    return cell;
  }

  public removeCell(cell: NotebookCellItem): void {
    const index = this.state.cells.indexOf(cell);
    if (index === -1) {
      return;
    }

    this.executeEdit({
      label: t('notebooks.history.delete-block', 'Delete block'),
      perform: () => this.removeCellInstance(cell),
      undo: () => this.insertCell(cell, index),
    });
  }

  private executeEdit(action: NotebookEditAction): void {
    this.commitPendingEdits();
    const history = this.editHistory;
    if (history) {
      history.execute(action);
    } else {
      action.perform();
    }
  }

  // Flushes both coalescing edit kinds before a discrete action starts, so neither is left sitting
  // underneath it on the undo stack, still open.
  public commitPendingEdits(): void {
    this.commitContentEdits();
    this.commitQueriesEdits();
  }

  private insertCell(cell: NotebookCellItem, index: number): void {
    if (this.state.cells.includes(cell)) {
      return;
    }

    const cells = [...this.state.cells];
    cells.splice(index, 0, cell);
    this.setState({ cells });
  }

  private removeCellInstance(cell: NotebookCellItem): void {
    const cells = this.state.cells.filter((candidate) => candidate !== cell);
    if (cells.length !== this.state.cells.length) {
      this.setState({ cells });
    }
  }

  private moveCellTo(cell: NotebookCellItem, toIndex: number): void {
    const fromIndex = this.state.cells.indexOf(cell);
    if (fromIndex === -1 || fromIndex === toIndex) {
      return;
    }

    const cells = [...this.state.cells];
    cells.splice(fromIndex, 1);
    cells.splice(toIndex, 0, cell);
    this.setState({ cells });
  }

  /**
   * `${base}-${n}` for the lowest n not yet taken. Checked against every cell rather than kept as a
   * counter, because the names a saved notebook arrives with are arbitrary and a counter would
   * eventually land on one of them.
   */
  private nextElementName(base: string): string {
    const taken = new Set(this.state.cells.map((current) => current.state.elementName));

    let suffix = 1;
    while (taken.has(`${base}-${suffix}`)) {
      suffix++;
    }

    return `${base}-${suffix}`;
  }

  public addPanel(): void {}

  public cloneLayout(): NotebookLayoutManager {
    return this.clone({});
  }

  // Same as the dashboard layout managers: a plain clone would reuse the originals' panel-<id> keys,
  // which collide in findVizPanelByKey and in the panelId enrichDataRequest feeds to query caching.
  public duplicate(panelIdGenerator?: PanelIdGenerator): NotebookLayoutManager {
    const nextId = panelIdGenerator ?? dashboardSceneGraph.getPanelIdGenerator(this);

    const cells = this.state.cells.map((cell) =>
      cell.clone({
        key: undefined,
        body: cell.state.body?.clone({ key: getVizPanelKeyForPanelId(nextId()) }),
        ...(cell.state.content ? { content: structuredClone(cell.state.content) } : {}),
      })
    );

    return this.clone({ key: undefined, cells });
  }

  public getOutlineChildren(): SceneObject[] {
    return [];
  }

  public getAllGridTypes(): string[] {
    return [];
  }

  public static createFromLayout(): NotebookLayoutManager {
    return new NotebookLayoutManager({ cells: [] });
  }
}

function NotebookLayoutManagerRenderer({ model }: SceneComponentProps<NotebookLayoutManager>) {
  const styles = useStyles2(getStyles);
  const { cells, title, tags, isEditing, key } = model.useState();

  const timeRange = sceneGraph.getTimeRange(model).useState();

  const onTagsChange = useCallback((nextTags: string[]) => model.setTagsFromHeader(nextTags), [model]);

  // Only the drop position lives in React state; the reorder itself lives on the model. onDragUpdate
  // fires when the drop index changes, not on every pointer move, so this re-renders the list a
  // handful of times per drag.
  const [drag, setDrag] = useState<NotebookDragState | null>(null);

  const [focusRequest, setFocusRequest] = useState<{ key: string; id: number; caretOffset?: number } | null>(null);
  const nextFocusId = useRef(0);
  // `caretOffset` only matters for a split (see onAdvance below): the new cell's content there isn't
  // just short starter text but carries the reader's own text along with it, so the default "end of
  // document" would land the caret after that carried-over text instead of at the actual split point.
  const requestFocus = useCallback((key: string | null | undefined, caretOffset?: number) => {
    if (!key) {
      setFocusRequest(null);
      return;
    }
    nextFocusId.current += 1;
    setFocusRequest({ key, id: nextFocusId.current, caretOffset });
  }, []);

  useEffect(() => {
    if (!isEditing) {
      return;
    }
    if (cells.length === 0) {
      requestFocus(model.appendSystemCell(0)?.state.key);
      return;
    }
    const last = cells[cells.length - 1];
    if (!isEmptyMarkdown(last.state.content)) {
      model.appendSystemCell(cells.length);
    }
  }, [isEditing, cells, model, requestFocus]);

  const onAdd = useCallback(
    (type: NotebookBlockType, index: number) => {
      // The reader asked for a block, so the caret belongs in it rather than one click away.
      requestFocus(model.addCell(type, index)?.state.key);
    },
    [model, requestFocus]
  );

  const onDragStart = useCallback((start: DragStart) => {
    setDrag({ source: start.source.index, destination: start.source.index });
  }, []);

  const onDragUpdate = useCallback((update: DragUpdate) => {
    setDrag({ source: update.source.index, destination: update.destination?.index ?? null });
  }, []);

  const onDragEnd = useCallback(
    (result: DropResult) => {
      setDrag(null);

      // Dropped outside the list, or back where it started.
      if (!result.destination || result.destination.index === result.source.index) {
        return;
      }

      model.moveCell(result.source.index, result.destination.index);
    },
    [model]
  );

  return (
    <div className={styles.document}>
      <header className={styles.header}>
        <NotebookDocumentHeader
          title={title}
          tags={tags}
          timeFrom={timeRange.from}
          timeTo={timeRange.to}
          isEditing={isEditing}
          onTagsChange={onTagsChange}
        />
      </header>

      <div className={styles.column}>
        {isEditing && cells.length > 0 && <NotebookAddBlockDivider index={0} onAdd={onAdd} />}

        <DragDropContext onDragStart={onDragStart} onDragUpdate={onDragUpdate} onDragEnd={onDragEnd}>
          <Droppable droppableId={key!} direction="vertical">
            {(dropProvided) => (
              <div
                className={cx(styles.list, isEditing && styles.listEditing)}
                ref={dropProvided.innerRef}
                {...dropProvided.droppableProps}
              >
                {cells.map((cell, index) => (
                  // Each frame is one Draggable and owns the divider below it, so a reorder moves a cell
                  // together with its insertion point and nothing has to be re-indexed. The trailing
                  // slot's own placeholder/"/" menu (see NotebookCellRenderer) key off whether a cell's
                  // own content is empty, not its position — the invariant above just guarantees the
                  // last cell always qualifies, with the same drag handle, hover actions, and
                  // "Add block" divider spacing every other cell already has, since it's a real cell
                  // rendered through the exact same path.
                  <NotebookCellFrame
                    key={cell.state.key}
                    cell={cell}
                    index={index}
                    isEditing={isEditing}
                    autoFocus={cell.state.key === focusRequest?.key}
                    focusRequestId={focusRequest && cell.state.key === focusRequest.key ? focusRequest.id : undefined}
                    caretOffset={
                      focusRequest && cell.state.key === focusRequest.key ? focusRequest.caretOffset : undefined
                    }
                    isDragActive={drag !== null}
                    dropIndicator={getCellDropIndicator(drag, index)}
                    // Bound here rather than resolved inside the frame: the cells list belongs to the
                    // manager, so the frame never needs to reach back up for its own position.
                    onAdd={onAdd}
                    onDuplicate={() => model.duplicateCell(cell)}
                    onDelete={() => confirmRemoveCell(model, cell)}
                    onAdvance={(remainder, marker) => {
                      // With neither a marker nor a remainder, insertCellAfter's own empty-paragraph
                      // default applies — see splitSeed for how the two combine otherwise.
                      const { text, caretOffset } = splitSeed(remainder, marker);
                      const created = model.insertCellAfter(
                        cell,
                        text !== undefined ? { kind: 'Markdown', spec: { text } } : undefined
                      );
                      // The split point, not the end of whatever text got carried along with it — see
                      // requestFocus's own doc comment on `caretOffset`.
                      requestFocus(created?.state.key, caretOffset);
                    }}
                    onFocusRequest={() => requestFocus(cell.state.key)}
                  />
                ))}
                {dropProvided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>
      </div>
    </div>
  );
}

/**
 * The content a freshly added or converted block starts with. Heading and paragraph are both markdown
 * cells — the menu offers them as separate entries because that is how a reader thinks about what
 * they're adding, but the editor underneath is the same one. A heading starts with its marker already
 * typed so the live-preview cell opens straight into "type your heading text" rather than a blank
 * block the reader has to know to prefix themselves.
 *
 * Visualization isn't handled here — it builds a `body` (a Panel VizPanel), not `content`. See
 * buildCellFor and convertCellToPanel; both intercept it before ever reaching this function, so the
 * case below is unreachable in practice — kept for the switch's own exhaustiveness.
 */
function contentForBlockType(type: NotebookBlockType): CellContentKind | undefined {
  switch (type) {
    case 'heading':
      return { kind: 'Markdown', spec: { text: '# ' } };
    case 'paragraph':
      return defaultMarkdownCellContentKind();
    case 'code':
      return defaultCodeCellContentKind();
    case 'visualization':
      return undefined;
  }
}

/**
 * Whether `content` is an untouched, empty markdown cell — the shape the trailing-slot invariant (see
 * setCellContent and the renderer's own bootstrap effect) watches for. `undefined` (a panel or
 * collapsed cell, which carries no `content` at all) deliberately does *not* count: it isn't a
 * typeable markdown slot either, so a panel ending up last must still get a fresh empty cell appended
 * after it, exactly like any other non-empty trailing content would.
 */
function isEmptyMarkdown(content: CellContentKind | undefined): boolean {
  return content?.kind === 'Markdown' && content.spec.text === '';
}

/**
 * What Enter's split-off cell (see NotebookLayoutManagerRenderer's onAdvance) should start with, and
 * where its caret belongs. `remainder` is every line MarkdownCell found after the caret, exactly as
 * the reader left it — which, for a cell that already holds further list items typed in via
 * Shift+Enter, includes those items too, each already carrying its own marker. `marker` only ever
 * describes the item the caret was actually in, so it only belongs in front of *that* item's leftover
 * text: once the caret sat at the very end of it, gluing the marker onto the whole remainder instead
 * would prefix an extra, empty item ahead of the next one rather than cleanly handing it over.
 */
export function splitSeed(
  remainder: string,
  marker: string | undefined
): { text: string | undefined; caretOffset: number } {
  if (marker === undefined) {
    return { text: remainder || undefined, caretOffset: 0 };
  }

  const newlineIndex = remainder.indexOf('\n');
  const restOfCaretLine = newlineIndex === -1 ? remainder : remainder.slice(0, newlineIndex);
  const laterLines = newlineIndex === -1 ? '' : remainder.slice(newlineIndex + 1);

  if (restOfCaretLine === '' && laterLines) {
    return { text: laterLines, caretOffset: 0 };
  }

  return { text: marker + remainder, caretOffset: marker.length };
}

function confirmRemoveCell(model: NotebookLayoutManager, cell: NotebookCellItem) {
  appEvents.publish(
    new ShowConfirmModalEvent({
      title: t('notebook.cell.delete-confirm-title', 'Delete block?'),
      text: t(
        'notebook.cell.delete-confirm-text',
        'This removes the block and its content from the notebook. Are you sure you want to continue?'
      ),
      yesText: t('notebook.cell.delete-confirm-yes', 'Delete'),
      onConfirm: () => model.removeCell(cell),
    })
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  document: css({
    maxWidth: 900,
    margin: '0 auto',
    padding: theme.spacing(3, 4, 6, 4),
    [theme.breakpoints.up('md')]: {
      paddingLeft: theme.spacing(7),
      paddingRight: theme.spacing(7),
    },
    width: '100%',
  }),
  header: css({
    marginBottom: theme.spacing(3),
    paddingBottom: theme.spacing(2),
    borderBottom: `1px solid ${theme.colors.border.weak}`,
  }),
  // Wraps the leading insertion point and the droppable list; the per-cell rhythm belongs to the list.
  column: css({
    display: 'flex',
    flexDirection: 'column',
    width: '100%',
  }),
  list: css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2),
    width: '100%',
  }),
  listEditing: css({
    gap: 0,
  }),
});
