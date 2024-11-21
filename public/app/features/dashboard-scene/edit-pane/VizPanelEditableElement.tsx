import { SceneObjectState, SceneObjectBase, VizPanel } from '@grafana/scenes';
import { Button, Switch } from '@grafana/ui';
import { OptionsPaneCategoryDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneCategoryDescriptor';
import { OptionsPaneItemDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneItemDescriptor';

import {
  PanelBackgroundSwitch,
  PanelDescriptionTextArea,
  PanelFrameTitleInput,
} from '../panel-edit/getPanelFrameOptions';
import { EditableDashboardElement, isDashboardLayoutItem } from '../scene/types';
import { getDashboardSceneFor } from '../utils/utils';

export class VizPanelEditableElement implements EditableDashboardElement {
  public isEditableDashboardElement: true = true;

  public constructor(private panel: VizPanel) {}

  public getEditPaneOptions(): OptionsPaneCategoryDescriptor[] {
    const panelOptions = new OptionsPaneCategoryDescriptor({
      title: '',
      id: '',
      isOpenDefault: true,
    });

    const panel = this.panel;
    const layoutElement = panel.parent!;

    panelOptions
      .addItem(
        new OptionsPaneItemDescriptor({
          title: 'Title',
          value: panel.state.title,
          popularRank: 1,
          render: function renderTitle() {
            return <PanelFrameTitleInput panel={panel} />;
          },
        })
      )
      .addItem(
        new OptionsPaneItemDescriptor({
          title: 'Description',
          value: panel.state.description,
          render: function renderDescription() {
            return <PanelDescriptionTextArea panel={panel} />;
          },
        })
      )
      .addItem(
        new OptionsPaneItemDescriptor({
          title: 'Transparent background',
          render: function renderTransparent() {
            return <PanelBackgroundSwitch panel={panel} />;
          },
        })
      );

    const categories = [panelOptions];

    if (isDashboardLayoutItem(layoutElement) && layoutElement.getOptions) {
      categories.push(layoutElement.getOptions());
    }

    return categories;
  }

  public getTypeName(): string {
    return 'Panel';
  }

  public onDelete = () => {
    const dashboard = getDashboardSceneFor(this.panel);
    dashboard.removePanel(this.panel);
  };

  public renderActions(): React.ReactNode {
    return (
      <>
        <Button size="sm" variant="secondary">
          Edit
        </Button>
        <Button size="sm" variant="secondary">
          Copy
        </Button>
        <Button size="sm" variant="destructive" fill="outline" onClick={this.onDelete}>
          Delete
        </Button>
      </>
    );
  }
}
