import { ReactNode, useId, useMemo } from 'react';

import { t, Trans } from '@grafana/i18n';
import { SceneObject, SceneVariableSet, type SceneVariables } from '@grafana/scenes';
import { Button } from '@grafana/ui';
import { OptionsPaneCategoryDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneCategoryDescriptor';
import { OptionsPaneItemDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneItemDescriptor';

import { DashboardScene } from '../../scene/DashboardScene';
import { useLayoutCategory } from '../../scene/layouts-shared/DashboardLayoutSelector';
import { EditableDashboardElement, EditableDashboardElementInfo } from '../../scene/types/EditableDashboardElement';
import { dashboardSceneGraph } from '../../utils/dashboardSceneGraph';

import { DashboardDescriptionInput, DashboardTitleInput } from './DashboardBasicOptions';
import { DashboardVariablesList } from './DashboardVariablesList';

function useEditPaneOptions(
  this: DashboardEditableElement,
  dashboard: DashboardScene
): OptionsPaneCategoryDescriptor[] {
  const { body, $variables } = dashboard.useState();
  const dashboardTitleInputId = useId();
  const dashboardDescriptionInputId = useId();

  const dashboardOptions = useMemo(() => {
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
  }, [dashboard, dashboardDescriptionInputId, dashboardTitleInputId]);

  const layoutCategory = useLayoutCategory(body);
  const variablesCategory = useVariablesCategory($variables);

  return [dashboardOptions, ...layoutCategory, ...variablesCategory];
}

export class DashboardEditableElement implements EditableDashboardElement {
  public readonly isEditableDashboardElement = true;

  public constructor(private dashboard: DashboardScene) {}

  public getEditableElementInfo(): EditableDashboardElementInfo {
    return {
      typeName: t('dashboard.edit-pane.elements.dashboard', 'Dashboard'),
      icon: 'apps',
      instanceName: t('dashboard.edit-pane.elements.dashboard', 'Dashboard'),
    };
  }

  public getOutlineChildren(isEditing: boolean): SceneObject[] {
    const { $variables, body } = this.dashboard.state;
    if (!isEditing || !$variables) {
      return body.getOutlineChildren();
    }
    return [$variables, dashboardSceneGraph.getDataLayers(this.dashboard), ...body.getOutlineChildren()];
  }

  public useEditPaneOptions = useEditPaneOptions.bind(this, this.dashboard);

  public renderActions(): ReactNode {
    return (
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
    );
  }
}

function useVariablesCategory(variableSet: SceneVariables | undefined): OptionsPaneCategoryDescriptor[] {
  const variableListId = useId();

  return useMemo(() => {
    if (!(variableSet instanceof SceneVariableSet) || !variableSet?.state.variables.length) {
      return [];
    }

    const category = new OptionsPaneCategoryDescriptor({
      title: t('dashboard-scene.use-variables-category.category.title.variables', 'Variables'),
      id: 'dashboard-variables',
    });

    category.addItem(
      new OptionsPaneItemDescriptor({
        title: '',
        id: variableListId,
        skipField: true,
        render: () => <DashboardVariablesList set={variableSet} />,
      })
    );

    return [category];
  }, [variableSet, variableListId]);
}
