import { useId, useMemo } from 'react';

import { t } from '@grafana/i18n';
import {
  type SceneObject,
  SceneObjectBase,
  type SceneObjectRef,
  type SceneObjectState,
  type SceneVariable,
  SceneVariableSet,
  sceneUtils,
} from '@grafana/scenes';
import { OptionsPaneCategoryDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneCategoryDescriptor';
import { OptionsPaneItemDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneItemDescriptor';

import { SectionFiltersList } from '../../edit-pane/SectionFiltersList';
import { partitionVariablesByDisplay } from '../../edit-pane/dashboard/DashboardVariablesList';
import {
  type EditableDashboardElement,
  type EditableDashboardElementInfo,
} from '../../scene/types/EditableDashboardElement';
import { filterSectionRepeatLocalVariables } from '../../variables/utils';

export interface SectionFiltersSetState extends SceneObjectState {
  sectionRef: SceneObjectRef<SceneObject>;
}

function useEditPaneOptions(
  this: SectionFiltersSet,
  sectionRef: SceneObjectRef<SceneObject>
): OptionsPaneCategoryDescriptor[] {
  const filterListId = useId();
  const sectionOwner = sectionRef.resolve();

  const options = useMemo(() => {
    const category = new OptionsPaneCategoryDescriptor({ title: '', id: 'section-filters' });

    category.addItem(
      new OptionsPaneItemDescriptor({
        title: '',
        id: filterListId,
        skipField: true,
        render: () => <SectionFiltersList sectionOwner={sectionOwner} />,
      })
    );

    return category;
  }, [filterListId, sectionOwner]);

  return [options];
}

export class SectionFiltersSet extends SceneObjectBase<SectionFiltersSetState> implements EditableDashboardElement {
  public readonly isEditableDashboardElement = true;

  public constructor(state: SectionFiltersSetState) {
    super({
      ...state,
      key: `section-filters-set-${state.sectionRef.resolve().state.key}`,
    });
  }

  public getEditableElementInfo(): EditableDashboardElementInfo {
    const filters = this.getAdhocVariables();
    return {
      typeName: t('dashboard.edit-pane.elements.section-filters-set', 'Filters'),
      icon: 'filter',
      instanceName: t('dashboard.edit-pane.elements.section-filters-set', 'Filters'),
      isHidden: filters.length === 0,
    };
  }

  public getOutlineChildren(): SceneObject[] {
    const { visible, controlsMenu, hidden } = partitionVariablesByDisplay(this.getAdhocVariables());
    return [...visible, ...controlsMenu, ...hidden];
  }

  private getAdhocVariables(): SceneVariable[] {
    const sectionOwner = this.state.sectionRef.resolve();
    const variableSet = sectionOwner.state.$variables;
    if (!(variableSet instanceof SceneVariableSet)) {
      return [];
    }
    return filterSectionRepeatLocalVariables(variableSet.state.variables, variableSet).filter(
      sceneUtils.isAdHocVariable
    );
  }

  public useEditPaneOptions = useEditPaneOptions.bind(this, this.state.sectionRef);
}
