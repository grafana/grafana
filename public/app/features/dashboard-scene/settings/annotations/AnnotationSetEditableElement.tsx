import { useId, useMemo } from 'react';

import { t } from '@grafana/i18n';
import { type SceneObject } from '@grafana/scenes';
import { OptionsPaneCategoryDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneCategoryDescriptor';
import { OptionsPaneItemDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneItemDescriptor';

import { partitionAnnotationsByDisplay } from '../../edit-pane/dashboard/DashboardAnnotationsList';
import { type DashboardDataLayerSet } from '../../scene/DashboardDataLayerSet';
import {
  type EditableDashboardElement,
  type EditableDashboardElementInfo,
} from '../../scene/types/EditableDashboardElement';

import { AnnotationList } from './AnnotationList';

function useEditPaneOptions(
  this: AnnotationSetEditableElement,
  dataLayerSet: DashboardDataLayerSet
): OptionsPaneCategoryDescriptor[] {
  const annotationListId = useId();

  const options = useMemo(() => {
    return new OptionsPaneCategoryDescriptor({ title: '', id: 'annotations' }).addItem(
      new OptionsPaneItemDescriptor({
        title: '',
        id: annotationListId,
        skipField: true,
        render: () => <AnnotationList dataLayerSet={dataLayerSet} />,
      })
    );
  }, [annotationListId, dataLayerSet]);

  return [options];
}

export class AnnotationSetEditableElement implements EditableDashboardElement {
  public readonly isEditableDashboardElement = true;

  public constructor(private dataLayerSet: DashboardDataLayerSet) {}

  public getEditableElementInfo(): EditableDashboardElementInfo {
    return {
      typeName: t('dashboard.edit-pane.elements.annotation-set', 'Annotations & Alerts'),
      icon: 'comment-alt',
      instanceName: t('dashboard.edit-pane.elements.annotation-set', 'Annotations & Alerts'),
      isHidden: this.dataLayerSet.state.annotationLayers.length === 0,
    };
  }

  public getOutlineChildren(): SceneObject[] {
    const { visible, controlsMenu, hidden } = partitionAnnotationsByDisplay(this.dataLayerSet.state.annotationLayers);
    return [...visible, ...controlsMenu, ...hidden];
  }

  public useEditPaneOptions = useEditPaneOptions.bind(this, this.dataLayerSet);
}
