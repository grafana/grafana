import { SceneObject, SceneObjectRef, VizPanel } from '@grafana/scenes';
import { Button, Stack, Text } from '@grafana/ui';
import { OptionsPaneCategoryDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneCategoryDescriptor';

import { MultiSelectedEditableDashboardElement } from '../scene/types';
import { dashboardSceneGraph } from '../utils/dashboardSceneGraph';

export class MultiSelectedVizPanelsEditableElement implements MultiSelectedEditableDashboardElement {
  public isMultiSelectedEditableDashboardElement: true = true;

  private items?: Array<SceneObjectRef<VizPanel>>;

  constructor(items: Map<string, SceneObjectRef<SceneObject>>) {
    for (const item of items.values()) {
      if (!this.items) {
        this.items = [];
      }

      const panel = item.resolve();
      if (panel instanceof VizPanel) {
        this.items.push(panel.getRef());
      }
    }
  }

  useEditPaneOptions(): OptionsPaneCategoryDescriptor[] {
    return [];
  }

  public onDelete = () => {
    for (const item of this.items || []) {
      const panel = item.resolve();
      const layout = dashboardSceneGraph.getLayoutManagerFor(panel);
      layout.removePanel(panel);
    }
  };

  public getTypeName(): string {
    return 'Panels';
  }

  renderActions(): React.ReactNode {
    return (
      <>
        <Stack direction={'column'}>
          <Text>{`No. of panels selected: ${this.items?.length}`}</Text>
          <Stack direction={'row'}>
            <Button size="sm" variant="secondary" icon="copy" />
            <Button size="sm" variant="destructive" fill="outline" onClick={this.onDelete} icon="trash-alt" />
          </Stack>
        </Stack>
      </>
    );
  }
}
