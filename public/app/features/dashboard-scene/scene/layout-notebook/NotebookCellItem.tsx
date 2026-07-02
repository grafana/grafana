import { SceneObjectBase, type SceneObjectState, type VizPanel } from '@grafana/scenes';
import { type CellContentKind } from '@grafana/schema/apis/dashboard.grafana.app/v2';

import { type DashboardLayoutItem } from '../types/DashboardLayoutItem';

export interface NotebookCellItemState extends SceneObjectState {
  // Name of the element this cell references in the dashboard `elements` map. Kept so
  // serialize() can round-trip the cell back to a NotebookLayoutItem.
  elementName: string;
  source: 'assistant' | 'user';
  // Optional to mirror the schema: an omitted `collapsed` must round-trip as omitted, not `false`.
  collapsed?: boolean;
  // A panel cell owns a VizPanel (parented here so the scene graph resolves data/time);
  // a markdown/code cell carries its content spec, rendered via the cell type registry.
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
