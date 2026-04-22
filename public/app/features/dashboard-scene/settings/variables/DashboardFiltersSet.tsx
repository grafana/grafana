import { useId, useMemo } from 'react';

import { t } from '@grafana/i18n';
import {
  type SceneObject,
  SceneObjectBase,
  type SceneObjectRef,
  type SceneObjectState,
  type SceneVariable,
  SceneVariableSet,
  sceneGraph,
  sceneUtils,
} from '@grafana/scenes';
import { OptionsPaneCategoryDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneCategoryDescriptor';
import { OptionsPaneItemDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneItemDescriptor';

import { AddFilterButton, DashboardFiltersList } from '../../edit-pane/dashboard/DashboardFiltersList';
import { partitionVariablesByDisplay } from '../../edit-pane/dashboard/DashboardVariablesList';
import { type DashboardScene } from '../../scene/DashboardScene';
import {
  type EditableDashboardElement,
  type EditableDashboardElementInfo,
} from '../../scene/types/EditableDashboardElement';

export interface DashboardFiltersSetState extends SceneObjectState {
  dashboardRef: SceneObjectRef<DashboardScene>;
}

function useEditPaneOptions(
  this: DashboardFiltersSet,
  dashboardRef: SceneObjectRef<DashboardScene>
): OptionsPaneCategoryDescriptor[] {
  const filterListId = useId();
  const addFilterButtonId = useId();
  const dashboard = dashboardRef.resolve();
  const variableSet = sceneGraph.getVariables(dashboard);

  const options = useMemo(() => {
    const category = new OptionsPaneCategoryDescriptor({ title: '', id: 'filters' });

    if (variableSet instanceof SceneVariableSet) {
      category.addItem(
        new OptionsPaneItemDescriptor({
          title: '',
          id: filterListId,
          skipField: true,
          render: () => <DashboardFiltersList variableSet={variableSet} />,
        })
      );
    }

    category.addItem(
      new OptionsPaneItemDescriptor({
        title: '',
        id: addFilterButtonId,
        skipField: true,
        render: () => <AddFilterButton dashboard={dashboard} />,
      })
    );

    return category;
  }, [filterListId, addFilterButtonId, dashboard, variableSet]);

  return [options];
}

export class DashboardFiltersSet extends SceneObjectBase<DashboardFiltersSetState> implements EditableDashboardElement {
  public readonly isEditableDashboardElement = true;

  public constructor(state: DashboardFiltersSetState) {
    super({ ...state, key: 'dashboard-filters-set' });
  }

  public getEditableElementInfo(): EditableDashboardElementInfo {
    const filters = this.getAdhocVariables();
    return {
      typeName: t('dashboard.edit-pane.elements.filters-set', 'Filters'),
      icon: 'filter',
      instanceName: t('dashboard.edit-pane.elements.filters-set', 'Filters'),
      isHidden: filters.length === 0,
    };
  }

  public getOutlineChildren(): SceneObject[] {
    const { visible, controlsMenu, hidden } = partitionVariablesByDisplay(this.getAdhocVariables());
    return [...visible, ...controlsMenu, ...hidden];
  }

  private getAdhocVariables(): SceneVariable[] {
    const dashboard = this.state.dashboardRef.resolve();
    const variableSet = sceneGraph.getVariables(dashboard);
    if (!(variableSet instanceof SceneVariableSet)) {
      return [];
    }
    return variableSet.state.variables.filter(sceneUtils.isAdHocVariable);
  }

  public useEditPaneOptions = useEditPaneOptions.bind(this, this.state.dashboardRef);
}
