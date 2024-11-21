import { SceneObjectBase, VizPanel } from '@grafana/scenes';
import { Button } from '@grafana/ui';
import { OptionsPaneCategoryDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneCategoryDescriptor';
import { OptionsPaneItemDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneItemDescriptor';

import {
  PanelBackgroundSwitch,
  PanelDescriptionTextArea,
  PanelFrameTitleInput,
} from '../panel-edit/getPanelFrameOptions';
import { EditableDashboardElement, isDashboardLayoutItem } from '../scene/types';
import { getDashboardSceneFor } from '../utils/utils';

export class VizPanelEditPaneBehavior extends SceneObjectBase implements EditableDashboardElement {
  public isEditableDashboardElement: true = true;

  private getPanel(): VizPanel {
    const panel = this.parent;

    if (!(panel instanceof VizPanel)) {
      throw new Error('VizPanelEditPaneBehavior must have a VizPanel parent');
    }

    return panel;
  }

  public getEditPaneOptions(): OptionsPaneCategoryDescriptor[] {
    const panelOptions = new OptionsPaneCategoryDescriptor({
      title: 'Panel options',
      id: 'panel-options',
      isOpenDefault: true,
    });

    const panel = this.getPanel();
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

    // TODO add visualization options & field config options
    return categories;
  }

  public getTypeName(): string {
    return 'Panel';
  }

  public onDelete = () => {
    // TODO this should just fetch parent layout manager
    const dashboard = getDashboardSceneFor(this);
    dashboard.removePanel(this.getPanel());
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
