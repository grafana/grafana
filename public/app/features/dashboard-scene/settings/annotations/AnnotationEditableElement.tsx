import { useId, useMemo } from 'react';

import { t } from '@grafana/i18n';
import { dataLayers } from '@grafana/scenes';
import { OptionsPaneCategoryDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneCategoryDescriptor';
import { OptionsPaneItemDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneItemDescriptor';

import { dashboardEditActions } from '../../edit-pane/shared';
import { DashboardAnnotationsDataLayer } from '../../scene/DashboardAnnotationsDataLayer';
import { DashboardDataLayerSet } from '../../scene/DashboardDataLayerSet';
import { EditableDashboardElement, EditableDashboardElementInfo } from '../../scene/types/EditableDashboardElement';

import {
  AnnotationColorPicker,
  AnnotationControlsDisplayPicker,
  AnnotationEnabledCheckbox,
  AnnotationNameInput,
  AnnotationPanelFilterPicker,
} from './AnnotationBasicOptions';
import { AnnotationQueryEditorButton } from './AnnotationQueryOptions';

export type AnnotationLayer = dataLayers.AnnotationsDataLayer | DashboardAnnotationsDataLayer;

function useEditPaneOptions(this: AnnotationEditableElement): OptionsPaneCategoryDescriptor[] {
  const annotationCategoryId = useId();
  const annotationNameId = useId();
  const enabledId = useId();
  const colorId = useId();
  const displayId = useId();
  const showInId = useId();
  const queryCategoryId = useId();

  const basicOptions = useMemo(() => {
    return new OptionsPaneCategoryDescriptor({ title: '', id: annotationCategoryId })
      .addItem(
        new OptionsPaneItemDescriptor({
          title: '',
          id: annotationNameId,
          render: () => <AnnotationNameInput layer={this.layer} />,
        })
      )
      .addItem(
        new OptionsPaneItemDescriptor({
          title: '',
          id: enabledId,
          render: () => <AnnotationEnabledCheckbox layer={this.layer} />,
        })
      )
      .addItem(
        new OptionsPaneItemDescriptor({
          title: '',
          id: colorId,
          render: () => <AnnotationColorPicker layer={this.layer} />,
        })
      )
      .addItem(
        new OptionsPaneItemDescriptor({
          title: '',
          id: displayId,
          render: () => <AnnotationControlsDisplayPicker layer={this.layer} />,
        })
      )
      .addItem(
        new OptionsPaneItemDescriptor({
          title: '',
          id: showInId,
          render: () => <AnnotationPanelFilterPicker layer={this.layer} />,
        })
      );
  }, [annotationCategoryId, annotationNameId, enabledId, colorId, displayId, showInId]);

  const queryEditorId = useId();

  const queryOptions = useMemo(() => {
    return new OptionsPaneCategoryDescriptor({
      title: t('dashboard.edit-pane.annotation.query', 'Query'),
      id: queryCategoryId,
    }).addItem(
      new OptionsPaneItemDescriptor({
        title: '',
        id: queryEditorId,
        render: () => <AnnotationQueryEditorButton layer={this.layer} />,
      })
    );
  }, [queryCategoryId, queryEditorId]);

  return [basicOptions, queryOptions];
}

export class AnnotationEditableElement implements EditableDashboardElement {
  public readonly isEditableDashboardElement = true;

  public constructor(public layer: AnnotationLayer) {}

  public getEditableElementInfo(): EditableDashboardElementInfo {
    return {
      typeName: t('dashboard.edit-pane.elements.annotation', 'Annotation'),
      icon: 'comment-alt',
      instanceName: this.layer.state.name,
      isHidden: this.layer.state.isHidden,
    };
  }

  public useEditPaneOptions = useEditPaneOptions.bind(this);

  public onDelete() {
    const dataLayerSet = this.layer.parent;

    if (dataLayerSet instanceof DashboardDataLayerSet) {
      dashboardEditActions.removeAnnotation({
        source: dataLayerSet,
        removedObject: this.layer,
      });
    }
  }
}
