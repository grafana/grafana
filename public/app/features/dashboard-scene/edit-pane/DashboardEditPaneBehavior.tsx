import { SceneObjectBase } from '@grafana/scenes';
import { Button, Input, Select, TextArea } from '@grafana/ui';
import { OptionsPaneCategoryDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneCategoryDescriptor';
import { OptionsPaneItemDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneItemDescriptor';

import { DashboardScene } from '../scene/DashboardScene';
import { layoutRegistry } from '../scene/layouts-shared/layoutRegistry';
import { DashboardLayoutManager, EditableDashboardElement, isLayoutParent, LayoutRegistryItem } from '../scene/types';
import { getDashboardSceneFor } from '../utils/utils';

export class DashboardEditPaneBehavior extends SceneObjectBase implements EditableDashboardElement {
  public isEditableDashboardElement: true = true;

  public getEditPaneOptions(): OptionsPaneCategoryDescriptor[] {
    const dashboardOptions = new OptionsPaneCategoryDescriptor({
      title: 'Dashboard options',
      id: 'dashboard-options',
      isOpenDefault: true,
    });

    const dashboard = getDashboardSceneFor(this);

    dashboardOptions.addItem(
      new OptionsPaneItemDescriptor({
        title: 'Title',
        render: function renderTitle() {
          return <DashboardTitleInput dashboard={dashboard} />;
        },
      })
    );

    dashboardOptions.addItem(
      new OptionsPaneItemDescriptor({
        title: 'Description',
        render: function renderTitle() {
          return <DashboardDescriptionInput dashboard={dashboard} />;
        },
      })
    );

    const categories = [dashboardOptions];

    const layoutCategory = new OptionsPaneCategoryDescriptor({
      title: 'Layout',
      id: 'layout-options',
      isOpenDefault: true,
    });

    layoutCategory.addItem(
      new OptionsPaneItemDescriptor({
        title: 'Type',
        render: function renderTitle() {
          return <DashboardLayoutSelector dashboard={dashboard} />;
        },
      })
    );

    categories.push(layoutCategory);

    return categories;
  }

  public getTypeName(): string {
    return 'Dashboard';
  }

  public onDelete = () => {};

  public renderActions(): React.ReactNode {
    return (
      <>
        <Button size="sm" variant="destructive" fill="outline" onClick={this.onDelete}>
          Delete
        </Button>
      </>
    );
  }
}

export function DashboardTitleInput({ dashboard }: { dashboard: DashboardScene }) {
  const { title } = dashboard.useState();

  return <Input value={title} onChange={(e) => dashboard.setState({ title: e.currentTarget.value })} />;
}

export function DashboardDescriptionInput({ dashboard }: { dashboard: DashboardScene }) {
  const { description } = dashboard.useState();

  return <TextArea value={description} onChange={(e) => dashboard.setState({ title: e.currentTarget.value })} />;
}

export function DashboardLayoutSelector({ dashboard }: { dashboard: DashboardScene }) {
  const { body: layoutManager } = dashboard.useState();

  const layouts = layoutRegistry.list();
  const options = layouts.map((layout) => ({
    label: layout.name,
    value: layout,
  }));

  const currentLayoutId = layoutManager.getDescriptor().id;
  const currentLayoutOption = options.find((option) => option.value.id === currentLayoutId);

  return (
    <Select
      options={options}
      value={currentLayoutOption}
      onChange={(option) => changeLayoutTo(layoutManager, option.value!)}
    />
  );
}

function changeLayoutTo(currentLayout: DashboardLayoutManager, newLayoutDescriptor: LayoutRegistryItem) {
  const layoutParent = currentLayout.parent;
  if (layoutParent && isLayoutParent(layoutParent)) {
    layoutParent.switchLayout(newLayoutDescriptor.createFromLayout(currentLayout));
  }
}
