import { ReactNode, useMemo } from 'react';

import { Trans } from '@grafana/i18n';
import { t } from '@grafana/i18n/internal';
import { Button, Input, TextArea } from '@grafana/ui';
import { OptionsPaneCategoryDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneCategoryDescriptor';
import { OptionsPaneItemDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneItemDescriptor';

import { DashboardScene } from '../scene/DashboardScene';
import { useLayoutCategory } from '../scene/layouts-shared/DashboardLayoutSelector';
import { EditSchemaV2Button } from '../scene/new-toolbar/actions/EditSchemaV2Button';
import { EditableDashboardElement, EditableDashboardElementInfo } from '../scene/types/EditableDashboardElement';

export class DashboardEditableElement implements EditableDashboardElement {
  public readonly isEditableDashboardElement = true;

  public constructor(private dashboard: DashboardScene) {}

  public getEditableElementInfo(): EditableDashboardElementInfo {
    return {
      typeName: t('dashboard.edit-pane.elements.dashboard', 'Dashboard'),
      icon: 'apps',
      instanceName: t('dashboard.edit-pane.elements.dashboard', 'Dashboard'),
      isContainer: true,
    };
  }

  public useEditPaneOptions(): OptionsPaneCategoryDescriptor[] {
    const dashboard = this.dashboard;

    // When layout changes we need to update options list
    const { body } = dashboard.useState();

    const dashboardOptions = useMemo(() => {
      const dashboardTitleInputId = 'dashboard-title-input';
      const dashboardDescriptionInputId = 'dashboard-description-input';
      const editPaneHeaderOptions = new OptionsPaneCategoryDescriptor({ title: '', id: 'dashboard-options' })
        .addItem(
          new OptionsPaneItemDescriptor({
            title: t('dashboard.options.title-option', 'Title'),
            id: dashboardTitleInputId,
            render: () => <DashboardTitleInput id={dashboardTitleInputId} dashboard={dashboard} />,
          })
        )
        .addItem(
          new OptionsPaneItemDescriptor({
            title: t('dashboard.options.description', 'Description'),
            id: dashboardDescriptionInputId,
            render: () => <DashboardDescriptionInput id={dashboardDescriptionInputId} dashboard={dashboard} />,
          })
        );

      return editPaneHeaderOptions;
    }, [dashboard]);

    const layoutCategory = useLayoutCategory(body);

    return [dashboardOptions, ...layoutCategory];
  }

  public renderActions(): ReactNode {
    return (
      <>
        <EditSchemaV2Button dashboard={this.dashboard} />
        <Button
          variant="secondary"
          size="sm"
          onClick={() => this.dashboard.onOpenSettings()}
          tooltip={t('dashboard.toolbar.dashboard-settings.tooltip', 'Dashboard settings')}
          icon="sliders-v-alt"
          iconPlacement="right"
        >
          <Trans i18nKey="dashboard.actions.open-settings">Settings</Trans>
        </Button>
      </>
    );
  }
}

export function DashboardTitleInput({ dashboard, id }: { dashboard: DashboardScene; id?: string }) {
  const { title } = dashboard.useState();

  return <Input id={id} value={title} onChange={(e) => dashboard.setState({ title: e.currentTarget.value })} />;
}

export function DashboardDescriptionInput({ dashboard, id }: { dashboard: DashboardScene; id?: string }) {
  const { description } = dashboard.useState();

  return (
    <TextArea
      id={id}
      value={description}
      onChange={(e) => dashboard.setState({ description: e.currentTarget.value })}
    />
  );
}
