import { v4 as uuidv4 } from 'uuid';

import { VizPanel } from '@grafana/scenes';
import { t } from 'app/core/internationalization';
import { OptionsPaneCategoryDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneCategoryDescriptor';

import { EditableDashboardElementInfo } from '../scene/types/EditableDashboardElement';
import { MultiSelectedEditableDashboardElement } from '../scene/types/MultiSelectedEditableDashboardElement';
import { dashboardSceneGraph } from '../utils/dashboardSceneGraph';

export class MultiSelectedVizPanelsEditableElement implements MultiSelectedEditableDashboardElement {
  public readonly isMultiSelectedEditableDashboardElement = true;
  public readonly key: string;

  constructor(private _panels: VizPanel[]) {
    this.key = uuidv4();
  }

  public getEditableElementInfo(): EditableDashboardElementInfo {
    return { name: t('dashboard.edit-pane.elements.panels', 'Panels'), typeId: 'panels', icon: 'folder' };
  }

  public useEditPaneOptions(): OptionsPaneCategoryDescriptor[] {
    const header = new OptionsPaneCategoryDescriptor({
      title: ``,
      id: '',
    });

    return [header];
  }

  public onDelete() {
    this._panels.forEach((panel) => {
      const layout = dashboardSceneGraph.getLayoutManagerFor(panel);
      layout.removePanel?.(panel);
    });
  }
}
