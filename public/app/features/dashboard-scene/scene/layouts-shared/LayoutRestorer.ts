import { vizPanelToSchemaV2 } from '../../serialization/transformSceneToSaveModelSchemaV2';
import { DashboardLayoutManager } from '../types/DashboardLayoutManager';

export class LayoutRestorer {
  private layoutMap: Record<string, DashboardLayoutManager> = {};

  public getLayout(
    newLayout: DashboardLayoutManager,
    currentLayout: DashboardLayoutManager
  ): DashboardLayoutManager | undefined {
    // If we have an old version of this layout and panels are the same we can reuse it
    const prevLayout = this.layoutMap[newLayout.descriptor.id];
    if (prevLayout) {
      const oldPanelSchema = prevLayout.getVizPanels().map(vizPanelToSchemaV2);
      const newPanelSchema = newLayout.getVizPanels().map(vizPanelToSchemaV2);
      if (JSON.stringify(oldPanelSchema) === JSON.stringify(newPanelSchema)) {
        return prevLayout;
      }
    }

    this.layoutMap[currentLayout.descriptor.id] = currentLayout;

    return newLayout;
  }
}
