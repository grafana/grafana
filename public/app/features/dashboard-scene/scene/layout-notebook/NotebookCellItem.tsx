import { SceneObjectBase, type SceneObjectState, type VizPanel } from '@grafana/scenes';
import { type CellContentKind } from '@grafana/schema/apis/notebook/v2beta1';

import { type DashboardLayoutItem } from '../types/DashboardLayoutItem';

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
}
