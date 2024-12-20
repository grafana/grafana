import { useMemo } from 'react';

import { Input, TextArea } from '@grafana/ui';
import { OptionsPaneCategoryDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneCategoryDescriptor';
import { OptionsPaneItemDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneItemDescriptor';

import { DashboardScene } from '../scene/DashboardScene';
import { useLayoutCategory } from '../scene/layouts-shared/DashboardLayoutSelector';
import { EditableDashboardElement } from '../scene/types';

export class DashboardEditableElement implements EditableDashboardElement {
  public isEditableDashboardElement: true = true;

  public constructor(private dashboard: DashboardScene) {}

  public useEditPaneOptions(): OptionsPaneCategoryDescriptor[] {
    const dashboard = this.dashboard;

    // When layout changes we need to update options list
    const { body } = dashboard.useState();

    const dashboardOptions = useMemo(() => {
      return new OptionsPaneCategoryDescriptor({
        title: 'Dashboard options',
        id: 'dashboard-options',
        isOpenDefault: true,
      })
        .addItem(
          new OptionsPaneItemDescriptor({
            title: 'Title',
            render: function renderTitle() {
              return <DashboardTitleInput dashboard={dashboard} />;
            },
          })
        )
        .addItem(
          new OptionsPaneItemDescriptor({
            title: 'Description',
            render: function renderTitle() {
              return <DashboardDescriptionInput dashboard={dashboard} />;
            },
          })
        );
    }, [dashboard]);

    const layoutCategory = useLayoutCategory(body);

    return [dashboardOptions, layoutCategory];
  }

  public getTypeName(): string {
    return 'Dashboard';
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
