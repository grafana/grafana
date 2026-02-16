import { useId, useMemo } from 'react';

import { t } from '@grafana/i18n';
import { SceneDataLayerProvider, SceneObject } from '@grafana/scenes';
import { OptionsPaneCategoryDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneCategoryDescriptor';
import { OptionsPaneItemDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneItemDescriptor';

import { DashboardDataLayerSet } from '../../scene/DashboardDataLayerSet';
import { EditableDashboardElement, EditableDashboardElementInfo } from '../../scene/types/EditableDashboardElement';

import { AnnotationList } from './AnnotationList';

export function partitionAnnotationLayers(layers: SceneDataLayerProvider[]) {
  const standardLayers: SceneDataLayerProvider[] = [];
  const controlsMenuLayers: SceneDataLayerProvider[] = [];

  layers.forEach((layer) => {
    if (layer.state.placement === 'inControlsMenu') {
      controlsMenuLayers.push(layer);
    } else {
      standardLayers.push(layer);
    }
  });

  return { standardLayers, controlsMenuLayers };
}

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
    const { standardLayers, controlsMenuLayers } = partitionAnnotationLayers(this.dataLayerSet.state.annotationLayers);
    return [...standardLayers, ...controlsMenuLayers];
  }

  public useEditPaneOptions = useEditPaneOptions.bind(this, this.dataLayerSet);
}
