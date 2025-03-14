import { ReactNode, useMemo } from 'react';

import { Button, Icon, Input, Stack, TextArea } from '@grafana/ui';
import { t, Trans } from 'app/core/internationalization';
import { OptionsPaneCategoryDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneCategoryDescriptor';
import { OptionsPaneItemDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneItemDescriptor';

import { DashboardScene } from '../scene/DashboardScene';
import { DashboardLayoutSelector } from '../scene/layouts-shared/DashboardLayoutSelector';
import { EditableDashboardElement, EditableDashboardElementInfo } from '../scene/types/EditableDashboardElement';

export class DashboardEditableElement implements EditableDashboardElement {
  public readonly isEditableDashboardElement = true;

  public constructor(private dashboard: DashboardScene) {}

  public getEditableElementInfo(): EditableDashboardElementInfo {
    return {
      typeName: t('dashboard.edit-pane.elements.dashboard', 'Dashboard'),
      icon: 'apps',
      instanceName: this.dashboard.state.title,
    };
  }

  public useEditPaneOptions(): OptionsPaneCategoryDescriptor[] {
    const dashboard = this.dashboard;

    // When layout changes we need to update options list
    const { body } = dashboard.useState();

    const dashboardOptions = useMemo(() => {
      const editPaneHeaderOptions = new OptionsPaneCategoryDescriptor({ title: '', id: 'dashboard-options' })
        .addItem(
          new OptionsPaneItemDescriptor({
            title: t('dashboard.options.title-option', 'Title'),
            render: () => <DashboardTitleInput dashboard={dashboard} />,
          })
        )
        .addItem(
          new OptionsPaneItemDescriptor({
            title: t('dashboard.options.description', 'Description'),
            render: () => <DashboardDescriptionInput dashboard={dashboard} />,
          })
        )
        .addItem(
          new OptionsPaneItemDescriptor({
            title: t('dashboard.layout.common.layout', 'Layout'),
            render: () => <DashboardLayoutSelector layoutManager={body} />,
          })
        );

      if (body.getOptions) {
        for (const option of body.getOptions()) {
          editPaneHeaderOptions.addItem(option);
        }
      }

      return editPaneHeaderOptions;
    }, [body, dashboard]);

    return [dashboardOptions];
  }

  public renderActions(): ReactNode {
    return (
      <Button
        variant="secondary"
        onClick={() => this.dashboard.onOpenSettings()}
        tooltip={t('dashboard.toolbar.dashboard-settings.tooltip', 'Dashboard settings')}
      >
        <Stack direction="row" gap={1} justifyContent="space-between" alignItems={'center'}>
          <span>
            <Trans i18nKey="dashboard.actions.open-settings">Settings</Trans>
          </span>
          <Icon name="sliders-v-alt" />
        </Stack>
      </Button>
    );
  }
}

export function DashboardTitleInput({ dashboard }: { dashboard: DashboardScene }) {
  const { title } = dashboard.useState();

  return <Input value={title} onChange={(e) => dashboard.setState({ title: e.currentTarget.value })} />;
}

export function DashboardDescriptionInput({ dashboard }: { dashboard: DashboardScene }) {
  const { description } = dashboard.useState();

  return <TextArea value={description} onChange={(e) => dashboard.setState({ description: e.currentTarget.value })} />;
}
