import { SceneObject, SceneObjectRef, VizPanel } from '@grafana/scenes';
import { Button } from '@grafana/ui';

import { BulkEditableDashboardElements } from '../scene/types';
import { dashboardSceneGraph } from '../utils/dashboardSceneGraph';

export class BulkVizPanelsEditableElement implements BulkEditableDashboardElements {
  public isBulkEditableDashboardElements: true = true;

  private items?: Array<SceneObjectRef<VizPanel>>;

  constructor(items: Array<SceneObjectRef<SceneObject>>) {
    for (const item of items) {
      if (!this.items) {
        this.items = [];
      }

      const panel = item.resolve();
      if (panel instanceof VizPanel) {
        this.items.push(panel.getRef());
      }
    }
  }

  public onDelete = () => {
    for (const item of this.items || []) {
      const panel = item.resolve();
      const layout = dashboardSceneGraph.getLayoutManagerFor(panel);
      layout.removePanel(panel);
    }
  };

  public getTypeName(): string {
    return 'Bulk Panels';
  }

  renderBulkActions(): React.ReactNode {
    return (
      <>
        <Button size="sm" variant="secondary" icon="copy" />
        <Button size="sm" variant="destructive" fill="outline" onClick={this.onDelete} icon="trash-alt" />
      </>
    );
  }
}
