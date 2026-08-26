import { SceneObjectBase, type SceneObjectState, type VizPanel } from '@grafana/scenes';
import { type DashboardLayoutItem } from 'app/features/dashboard-scene/scene/types/DashboardLayoutItem';

import { type CellContentKind } from '../../types';

import { type NotebookLayoutManager } from './NotebookLayoutManager';
import { type NotebookBlockType } from './edit/NotebookBlockTypeMenu';
import { isNotebookLayoutManager } from './isNotebookLayoutManager';

export interface NotebookCellItemState extends SceneObjectState {
  // Name of the element this cell references in the notebook `elements` map. Kept so
  // serialize() can round-trip the cell back to a NotebookLayoutItem.
  elementName: string;
  source: 'assistant' | 'user';
  // Optional to mirror the schema: an omitted `collapsed` must round-trip as omitted, not `false`.
  collapsed?: boolean;
  // A cell is either a panel or narrative content, never both. `body` deliberately follows the
  // DashboardLayoutItem convention (every layout item exposes its wrapped VizPanel at
  // `.state.body`, set via setElementBody) so the panel editor and scene-graph tooling can find
  // it when edit mode is added. A markdown/code cell instead carries its content spec, which the
  // cell type registry renders.
  body?: VizPanel;
  content?: CellContentKind;
}

export class NotebookCellItem extends SceneObjectBase<NotebookCellItemState> implements DashboardLayoutItem {
  public readonly isNotebookCell = true as const;
  // A panel cell is the panel's parent in the scene graph, so it must be a
  // DashboardLayoutItem for the panel editor to open and apply edits.
  public readonly isDashboardLayoutItem = true;

  public setElementBody(body: VizPanel) {
    this.setState({ body });
  }

  /**
   * Records an edit to this cell's narrative content.
   *
   * Routed through the layout manager rather than straight onto this cell: two layout items may
   * legally reference one element, and serialize() folds them back into a single `elements` entry
   * where the last one processed wins — so writing only here would lose the edit whenever an unedited
   * duplicate follows it. The manager owns `cells`, so it is the only thing that can see the siblings.
   */
  public onContentChange(content: CellContentKind): void {
    this.getParentLayout().setCellContent(this, content);
  }

  /**
   * Converts this cell's content to `type` in place — the trailing-slot markdown cell's own "/" menu
   * (see NotebookCellRenderer) uses this instead of onContentChange directly, since picking a type is a
   * different intent than typing text, and the manager owns contentForBlockType's starter text/markers.
   */
  public onConvert(type: NotebookBlockType): void {
    this.getParentLayout().convertCell(this, type);
  }

  /**
   * Throws rather than returning undefined, matching getLayoutManagerFor: a cell outside a layout is a
   * wiring mistake, and failing quietly here would look like an editor that drops what you type.
   *
   * Resolved on demand rather than at construction, so a cell can still be built and rendered on its
   * own — only editing one needs the ancestor.
   */
  public getParentLayout(): NotebookLayoutManager {
    let parent = this.parent;

    while (parent) {
      if (isNotebookLayoutManager(parent)) {
        return parent;
      }
      parent = parent.parent;
    }

    throw new Error('NotebookCellItem is not inside a NotebookLayoutManager');
  }
}
