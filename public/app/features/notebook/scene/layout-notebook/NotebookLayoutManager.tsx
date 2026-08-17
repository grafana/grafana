import { css, cx } from '@emotion/css';
import { DragDropContext, Droppable, type DragStart, type DragUpdate, type DropResult } from '@hello-pangea/dnd';
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

import { type NotebookLayoutItemKind, type NotebookLayoutKind } from '../../types';

import { type NotebookCellItem } from './NotebookCellItem';
import { NotebookDocumentHeader } from './NotebookDocumentHeader';
import { NotebookAddBlockDivider } from './edit/NotebookAddBlockDivider';
import { NotebookAddBlockPrompt } from './edit/NotebookAddBlockPrompt';
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
      elementName: this.nextElementName(cell.state.elementName),
      body: cell.state.body?.clone({ key: getVizPanelKeyForPanelId(nextId()) }),
      ...(cell.state.content ? { content: structuredClone(cell.state.content) } : {}),
    });

    const cells = [...this.state.cells];
    cells.splice(index + 1, 0, copy);
    this.setState({ cells });
  }

  public removeCell(cell: NotebookCellItem): void {
    const cells = this.state.cells.filter((candidate) => candidate !== cell);

    if (cells.length !== this.state.cells.length) {
      this.setState({ cells });
    }
  }

  /**
   * A name derived from the original and not yet taken. Checked against every cell rather than a counter,
   * because the names a saved notebook arrives with are arbitrary and a counter would eventually land on
   * one of them.
   */
  private nextElementName(base: string): string {
    const taken = new Set(this.state.cells.map((current) => current.state.elementName));

    let suffix = 1;
    while (taken.has(`${base}-copy-${suffix}`)) {
      suffix++;
    }

    return `${base}-copy-${suffix}`;
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
        {isEditing && cells.length > 0 && <NotebookAddBlockDivider index={0} />}

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
                    isDragActive={drag !== null}
                    dropIndicator={getCellDropIndicator(drag, index)}
                    // Bound here rather than resolved inside the frame: the cells list belongs to the
                    // manager, so the frame never needs to reach back up for its own position.
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
        {isEditing && <NotebookAddBlockPrompt index={cells.length} />}
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
