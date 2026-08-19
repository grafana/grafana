import { css, cx } from '@emotion/css';
import { DragDropContext, Droppable, type DragStart, type DragUpdate, type DropResult } from '@hello-pangea/dnd';
import { useCallback, useEffect, useRef, useState } from 'react';

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
  defaultMarkdownCellContentKind,
  type NotebookLayoutItemKind,
  type NotebookLayoutKind,
} from '../../types';

import { NotebookCellItem } from './NotebookCellItem';
import { NotebookDocumentHeader } from './NotebookDocumentHeader';
import { NotebookAddBlockDivider } from './edit/NotebookAddBlockDivider';
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

  // Serialization lives here (not in a standalone helper) so the manager doesn't import the
  // serializer module — that mutual import is what forms a dependency cycle. The serializer
  // still imports this manager to construct it in deserialize, which stays one-directional.
  public serialize(): NotebookLayoutKind {
    const cells: NotebookLayoutItemKind[] = this.state.cells.map((cell) => ({
      kind: 'NotebookLayoutItem',
      spec: {
        element: { kind: 'ElementReference', name: cell.state.elementName },
        source: cell.state.source,
        // Emit collapsed only when it was set, so an omitted value stays omitted on round-trip.
        ...(cell.state.collapsed !== undefined ? { collapsed: cell.state.collapsed } : {}),
      },
    }));

    return { kind: 'NotebookLayout', spec: { cells } };
  }

  // Only panel cells are viz panels; markdown/code cells are narrative content and are
  // intentionally invisible to the rest of the scene (query runner, edit tooling).
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
   *
   * Also maintains the "always one more empty block ready" invariant (Notion/Datadog's own feel):
   * the moment the trailing cell — and only the trailing cell — stops being empty, a fresh empty one
   * takes its place at the tail, so the reader never has to explicitly ask for the next block just to
   * keep typing. Gated on the *transition* (was empty, now isn't), not merely "is non-empty", so this
   * doesn't append again on every subsequent keystroke into what is now a real, settled cell.
   */
  public setCellContent = (target: NotebookCellItem, content: CellContentKind): void => {
    const wasEmpty = isEmptyMarkdown(target.state.content);
    const index = this.state.cells.indexOf(target);

    for (const cell of this.state.cells) {
      // Panel cells carry no content and must not gain any.
      if (cell.state.content && cell.state.elementName === target.state.elementName) {
        cell.setState({ content });
      }
    }

    if (wasEmpty && !isEmptyMarkdown(content) && index === this.state.cells.length - 1) {
      this.addCell('paragraph', this.state.cells.length);
    }
  };

  /**
   * Converts `cell`'s content to `type` in place — the trailing-slot markdown cell's "/" menu (see
   * NotebookCellRenderer) uses this rather than inserting a separate new cell the way the add-block
   * menu does, since the cell picking from that menu already exists and is already empty.
   */
  public convertCell(cell: NotebookCellItem, type: NotebookBlockType): void {
    const content = contentForBlockType(type);
    if (content) {
      this.setCellContent(cell, content);
    }
  }

  /**
   * Reorders a cell, mirroring RowsLayoutManager.moveRow. The cell objects move rather than being
   * rebuilt, so a panel cell keeps its VizPanel and its already-fetched data across the move.
   */
  public moveCell(fromIndex: number, toIndex: number) {
    const cells = [...this.state.cells];
    const [removed] = cells.splice(fromIndex, 1);
    cells.splice(toIndex, 0, removed);
    this.setState({ cells });
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

    const cells = [...this.state.cells];
    cells.splice(index, 0, cell);
    this.setState({ cells });

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

    const cells = [...this.state.cells];
    cells.splice(index + 1, 0, copy);
    this.setState({ cells });
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

    const cells = [...this.state.cells];
    cells.splice(index + 1, 0, cell);
    this.setState({ cells });

    return cell;
  }

  public removeCell(cell: NotebookCellItem): void {
    const cells = this.state.cells.filter((candidate) => candidate !== cell);

    if (cells.length !== this.state.cells.length) {
      this.setState({ cells });
    }
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
  //
  // `id` is a monotonic nonce, not just the cell's `key`: a focus *request* can target a cell that is
  // already the target — e.g. picking "Paragraph" or "Heading" from a markdown cell's own "/" menu
  // (see NotebookCellRenderer's handlePick) converts the same cell in place, so its key never changes.
  // The menu click already moved DOM focus to the button it clicked, but setting state to the key it
  // already held would be a no-op React bails out of, and MarkdownCell would never see a reason to
  // call `.focus()` again. Bumping `id` on every request, even a same-key one, gives it something
  // that always changes.
  const [focusRequest, setFocusRequest] = useState<{ key: string; id: number } | null>(null);
  const nextFocusId = useRef(0);
  const requestFocus = useCallback((key: string | null | undefined) => {
    if (!key) {
      setFocusRequest(null);
      return;
    }
    nextFocusId.current += 1;
    setFocusRequest({ key, id: nextFocusId.current });
  }, []);

  // Bootstraps and maintains the other half of the "always one more empty block ready" invariant —
  // setCellContent (on the model) handles the reactive half, appending as soon as the trailing cell
  // stops being empty, but that only ever fires from an edit already in flight. This covers the two
  // cases with no edit to react to: a brand-new empty notebook, and entering edit mode on a notebook
  // whose last cell already has content (e.g. loaded from a save). Re-running on every `cells` change
  // is deliberately cheap and self-terminating — once the trailing cell is the required empty one, the
  // condition is false and this is a no-op.
  //
  // Only the brand-new-notebook case also takes the caret: a reader creating a notebook should be able
  // to start typing immediately, with no extra click, the same way the very first cell of any fresh
  // document would. Entering edit mode on a notebook that already has content doesn't get this — the
  // reader hasn't clicked anywhere yet, and stealing focus to a cell at the very end they may not even
  // be looking at would be a worse first move than leaving the caret alone.
  useEffect(() => {
    if (!isEditing) {
      return;
    }
    if (cells.length === 0) {
      requestFocus(model.addCell('paragraph', 0)?.state.key);
      return;
    }
    const last = cells[cells.length - 1];
    if (!isEmptyMarkdown(last.state.content)) {
      model.addCell('paragraph', cells.length);
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
                  // together with its insertion point and nothing has to be re-indexed. The trailing
                  // slot's own placeholder/"/" menu (see NotebookCellRenderer) key off whether a cell's
                  // own content is empty, not its position — the invariant above just guarantees the
                  // last cell always qualifies, with the same drag handle, hover actions, and
                  // "Add block" divider spacing every other cell already has, since it's a real cell
                  // rendered through the exact same path.
                  //
                  // onAdvance is wired for every cell, not just the one before the trailing slot: Enter
                  // splits into a genuinely new cell right after wherever the reader's cursor actually
                  // is (matching Notion's own "Enter always makes a new block here" gesture), not a
                  // jump to whatever the document's trailing slot happens to be — even when one already
                  // exists a few cells away. `insertCellAfter` (not the trailing-slot invariant) owns
                  // this; the two are independent, so both can fire from the same keystroke.
                  <NotebookCellFrame
                    key={cell.state.key}
                    cell={cell}
                    index={index}
                    isEditing={isEditing}
                    autoFocus={cell.state.key === focusRequest?.key}
                    focusRequestId={focusRequest && cell.state.key === focusRequest.key ? focusRequest.id : undefined}
                    isDragActive={drag !== null}
                    dropIndicator={getCellDropIndicator(drag, index)}
                    // Bound here rather than resolved inside the frame: the cells list belongs to the
                    // manager, so the frame never needs to reach back up for its own position.
                    onAdd={onAdd}
                    onDuplicate={() => model.duplicateCell(cell)}
                    onDelete={() => confirmRemoveCell(model, cell)}
                    onAdvance={(marker) => {
                      const created = model.insertCellAfter(
                        cell,
                        marker !== undefined ? { kind: 'Markdown', spec: { text: marker } } : undefined
                      );
                      requestFocus(created?.state.key);
                    }}
                    // The "/" menu converts this same cell in place (see NotebookCellRenderer's
                    // handlePick) rather than inserting a new one — clicking a menu item moves DOM
                    // focus to the button, and a picked type that changes content.kind (e.g. "Code")
                    // unmounts this cell's editor for a different one entirely. A picked type that
                    // *doesn't* change content.kind (Paragraph, Heading — both stay "Markdown") is the
                    // trickier case: this cell's own key never changes, so requestFocus's nonce (see
                    // focusRequest's own doc comment above) is what actually gets the caret back, not
                    // the key comparison alone.
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
