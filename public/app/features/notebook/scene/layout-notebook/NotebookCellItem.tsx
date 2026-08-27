import { SceneObjectBase, type SceneObjectState, type VizPanel } from '@grafana/scenes';
import { type DataQuery } from '@grafana/schema';
import { type DashboardLayoutItem } from 'app/features/dashboard-scene/scene/types/DashboardLayoutItem';

import { type CellContentKind } from '../../types';

import { type NotebookLayoutManager } from './NotebookLayoutManager';
import { type NotebookBlockType } from './edit/NotebookBlockTypeMenu';
import { isNotebookLayoutManager } from './isNotebookLayoutManager';

export interface NotebookCellItemState extends SceneObjectState {
  // Key into the notebook's `elements` map — lets serialize() round-trip the cell.
  elementName: string;
  source: 'assistant' | 'user';
  // Optional to mirror the schema: an omitted `collapsed` must round-trip as omitted, not `false`.
  collapsed?: boolean;
  // A cell is either a panel or narrative content, never both. `body` follows the DashboardLayoutItem
  // convention (wrapped VizPanel at `.state.body`, set via setElementBody) so the panel editor and
  // scene-graph tooling can find it. A markdown/code cell carries `content` instead.
  body?: VizPanel;
  content?: CellContentKind;
}

export class NotebookCellItem extends SceneObjectBase<NotebookCellItemState> implements DashboardLayoutItem {
  public readonly isNotebookCell = true as const;
  // A panel cell is the panel's parent in the scene graph, so it must be a DashboardLayoutItem.
  public readonly isDashboardLayoutItem = true;

  // Also clears `content` to hold the "never both" invariant above. `elementName` is optional to
  // match the DashboardLayoutItem interface's signature, but NotebookLayoutManager.convertCellToPanel
  // (the only caller) always passes one: this cell may still share its old name with a sibling.
  public setElementBody(body: VizPanel, elementName?: string) {
    this.setState({ body, content: undefined, elementName: elementName ?? this.state.elementName });
  }

  /**
   * Records an edit to this cell's narrative content. Routed through the layout manager rather than
   * straight onto this cell: two cells may legally share one `elementName`, and only the manager can
   * see siblings to keep them all up to date (serialize() would otherwise drop the edit on reload).
   */
  public onContentChange(content: CellContentKind): void {
    this.getParentLayout().setCellContent(this, content);
  }

  /** Converts this cell's content to `type` in place — see NotebookLayoutManager.convertCell. */
  public onConvert(type: NotebookBlockType): void {
    this.getParentLayout().convertCell(this, type);
  }

  public onQueryChange(queries: DataQuery[]): void {
    this.getParentLayout().setCellQueries(this, queries);
  }

  public onQueryStructureChange(label: string, queries: DataQuery[]): void {
    this.getParentLayout().runQueryEdit(this, label, queries);
  }

  /** Throws rather than returning undefined: a cell outside a layout is a wiring mistake. */
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
