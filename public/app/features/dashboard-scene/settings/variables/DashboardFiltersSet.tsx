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

import { type DashboardScene } from '../../scene/DashboardScene';
import {
  type EditableDashboardElement,
  type EditableDashboardElementInfo,
} from '../../scene/types/EditableDashboardElement';
import { partitionVariablesByDisplay } from '../../sidebar/dashboard/DashboardVariablesList';

export interface DashboardFiltersSetState extends SceneObjectState {
  dashboardRef: SceneObjectRef<DashboardScene>;
}

export class DashboardFiltersSet extends SceneObjectBase<DashboardFiltersSetState> implements EditableDashboardElement {
  public readonly isEditableDashboardElement = true;

  public constructor(state: DashboardFiltersSetState) {
    super({ ...state, key: 'dashboard-filters-set' });
  }

  public getEditableElementInfo(): EditableDashboardElementInfo {
    return {
      typeName: t('dashboard.sidebar.elements.filters-set', 'Filters'),
      icon: 'filter',
      instanceName: t('dashboard.sidebar.elements.filters-set', 'Filters'),
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
}
