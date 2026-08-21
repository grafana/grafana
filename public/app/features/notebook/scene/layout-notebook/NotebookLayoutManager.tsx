import { css, cx } from '@emotion/css';
import { DragDropContext, Droppable, type DragStart, type DragUpdate, type DropResult } from '@hello-pangea/dnd';
import { isEqual } from 'lodash';
import { useCallback, useState } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import {
  sceneGraph,
  SceneObjectBase,
  type SceneComponentProps,
  type SceneObject,
  type SceneObjectState,
  type VizPanel,
} from '@grafana/scenes';
import { useStyles2 } from '@grafana/ui';
import { appEvents } from 'app/core/app_events';
import { type DashboardLayoutManager } from 'app/features/dashboard-scene/scene/types/DashboardLayoutManager';
import { type LayoutRegistryItem } from 'app/features/dashboard-scene/scene/types/LayoutRegistryItem';
import { dashboardSceneGraph, type PanelIdGenerator } from 'app/features/dashboard-scene/utils/dashboardSceneGraph';
import { getVizPanelKeyForPanelId } from 'app/features/dashboard-scene/utils/utils';
import { ShowConfirmModalEvent } from 'app/types/events';

import {
  type CellContentKind,
  defaultCodeCellContentKind,
  type NotebookLayoutItemKind,
  type NotebookLayoutKind,
} from '../../types';
import { type NotebookEditAction, type NotebookEditHistory } from '../NotebookEditHistory';
import { isNotebookScene } from '../isNotebookScene';

import { NotebookCellItem } from './NotebookCellItem';
import { NotebookDocumentHeader } from './NotebookDocumentHeader';
import { NotebookAddBlockDivider } from './edit/NotebookAddBlockDivider';
import { NotebookAddBlockPrompt } from './edit/NotebookAddBlockPrompt';
import { type NotebookBlockType } from './edit/NotebookBlockTypeMenu';
import { getCellDropIndicator, NotebookCellFrame, type NotebookDragState } from './edit/NotebookCellFrame';

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

  public constructor(state: NotebookLayoutManagerState) {
    super(state);

    // Typing is grouped into one undo step that sits in a field until the typing stops. Without this,
    // closing the notebook mid-word would leave that step behind, and the next typing would join it.
    this.addActivationHandler(() => {
      return () => this.commitContentEdits();
    });
  }

  /**
   * The scene above owns the history, so reading it here means nothing has to hand it over again when
   * the scene swaps its body. duplicate(), the deserializer and tests build a manager with no scene
   * above it. Editing one of those still works, the changes are just not recorded.
   */
  private get editHistory(): NotebookEditHistory | undefined {
    let parent = this.parent;

    while (parent) {
      if (isNotebookScene(parent)) {
        return parent.editHistory;
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

  /**
   * Applies narrative content to every cell referencing the same element.
   *
   * Two layout items may legally reference one element, and the deserializer gives each its own
   * cell — two views of one thing. serialize() collapses them back into a single elements[name]
   * entry where the last cell processed wins, so updating only the edited cell loses the edit
   * outright whenever an unedited duplicate follows it.
   *
   * It lives on the manager because that is what owns `cells`; a cell cannot see its siblings.
   */
  public setCellContent = (target: NotebookCellItem, content: CellContentKind): void => {
    const previous = target.state.content;
    if (!previous || isEqual(previous, content)) {
      return;
    }

    const pending = this.pendingContentEdit;
    if (pending?.elementName === target.state.elementName) {
      this.extendContentEdit(pending, content);
      return;
    }

    this.commitContentEdits();
    this.startContentEdit(target.state.elementName, previous, content);
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
   * Inserts a new empty cell at `index`, the position the add-block affordance was offering.
   *
   * Only code blocks are buildable so far. The remaining menu entries stay inert rather than inserting
   * a cell with no content kind behind it, which the renderer would draw as a blank gap.
   *
   * Returns the new cell so the caller can hand it the caret; undefined when nothing was inserted.
   */
  public addCell = (type: NotebookBlockType, index: number): NotebookCellItem | undefined => {
    if (type !== 'code') {
      return undefined;
    }

    const cell = new NotebookCellItem({
      // A fresh name for the same reason duplicateCell needs one: serialize() writes it as the key into
      // the notebook's `elements` map, so reusing one would collapse the two cells into one element.
      elementName: this.nextElementName('code'),
      // Everything the add-block menu inserts was asked for by a person, not proposed by the assistant.
      source: 'user',
      content: defaultCodeCellContentKind(),
    });

    const insertionIndex = Math.max(0, Math.min(index, this.state.cells.length));
    this.executeEdit({
      label: t('notebooks.history.add-block', 'Add block'),
      perform: () => this.insertCell(cell, insertionIndex),
      undo: () => this.removeCellInstance(cell),
    });

    return cell;
  };

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
    this.commitContentEdits();
    const history = this.editHistory;
    if (history) {
      history.execute(action);
    } else {
      action.perform();
    }
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

  // Only the drop position lives in React state; the reorder itself lives on the model. onDragUpdate
  // fires when the drop index changes, not on every pointer move, so this re-renders the list a
  // handful of times per drag.
  const [drag, setDrag] = useState<NotebookDragState | null>(null);

  // Which cell holds the caret, for the same reason: an insertion is a moment, not part of the
  // notebook, so it has no business on the model or in what gets serialized. It survives until the
  // next insertion, which is harmless — the cell it names already has the caret, and the extension
  // that placed it there only runs when the editor is built.
  const [focusedCellKey, setFocusedCellKey] = useState<string | null>(null);

  const onAdd = useCallback(
    (type: NotebookBlockType, index: number) => {
      // The reader asked for a block, so the caret belongs in it rather than one click away.
      setFocusedCellKey(model.addCell(type, index)?.state.key ?? null);
    },
    [model]
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
        <NotebookDocumentHeader title={title} tags={tags} timeFrom={timeRange.from} timeTo={timeRange.to} />
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
                  // together with its insertion point and nothing has to be re-indexed.
                  <NotebookCellFrame
                    key={cell.state.key}
                    cell={cell}
                    index={index}
                    isEditing={isEditing}
                    autoFocus={cell.state.key === focusedCellKey}
                    isDragActive={drag !== null}
                    dropIndicator={getCellDropIndicator(drag, index)}
                    // Bound here rather than resolved inside the frame: the cells list belongs to the
                    // manager, so the frame never needs to reach back up for its own position.
                    onAdd={onAdd}
                    onDuplicate={() => model.duplicateCell(cell)}
                    onDelete={() => confirmRemoveCell(model, cell)}
                  />
                ))}
                {dropProvided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>

        {/* The end of the document. Outside the droppable, like the leading divider, and always visible
            rather than hover-revealed. cells.length is the append position — the same one the last cell's
            divider offers */}
        {isEditing && <NotebookAddBlockPrompt index={cells.length} onAdd={onAdd} />}
      </div>
    </div>
  );
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
