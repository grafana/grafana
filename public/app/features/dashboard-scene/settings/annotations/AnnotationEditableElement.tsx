import { useId, useMemo } from 'react';

import { t } from '@grafana/i18n';
import { type dataLayers } from '@grafana/scenes';
import { appEvents } from 'app/core/app_events';
import { OptionsPaneCategoryDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneCategoryDescriptor';
import { OptionsPaneItemDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneItemDescriptor';
import { ShowConfirmModalEvent } from 'app/types/events';

import { type DashboardAnnotationsDataLayer } from '../../scene/DashboardAnnotationsDataLayer';
import { DashboardDataLayerSet } from '../../scene/DashboardDataLayerSet';
import {
  type EditableDashboardElement,
  type EditableDashboardElementInfo,
} from '../../scene/types/EditableDashboardElement';

import {
  AnnotationColorPicker,
  AnnotationControlsDisplayPicker,
  AnnotationEnabledCheckbox,
  AnnotationNameInput,
  AnnotationPanelFilterPicker,
} from './AnnotationBasicOptions';
import { AnnotationQueryEditorButton } from './AnnotationQueryOptions';
import { annotationEditActions } from './actions';

export type AnnotationLayer = dataLayers.AnnotationsDataLayer | DashboardAnnotationsDataLayer;

function useEditPaneOptions(this: AnnotationEditableElement, isNewElement: boolean): OptionsPaneCategoryDescriptor[] {
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
          render: () => <AnnotationNameInput layer={this.layer} autoFocus={isNewElement} />,
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
  }, [annotationCategoryId, annotationNameId, enabledId, colorId, displayId, showInId, isNewElement]);

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

  public onDuplicate() {
    const dataLayerSet = this.layer.parent;
    if (!(dataLayerSet instanceof DashboardDataLayerSet)) {
      return;
    }

    annotationEditActions.addAnnotation({
      source: dataLayerSet,
      addedObject: this.layer.clone({
        key: undefined,
        name: `${this.layer.state.name} - Copy`,
      }),
    });
  }

  public onConfirmDelete() {
    const name = this.layer.state.name;
    appEvents.publish(
      new ShowConfirmModalEvent({
        title: t('dashboard-scene.annotation-editable-element.delete-title', 'Delete annotation query'),
        text: t(
          'dashboard-scene.annotation-editable-element.delete-text',
          'Are you sure you want to delete: {{name}}?',
          { name }
        ),
        yesText: t('dashboard-scene.annotation-editable-element.delete-confirm', 'Delete annotation query'),
        onConfirm: () => {
          this.onDelete();
        },
      })
    );
  }

  public onDelete() {
    const dataLayerSet = this.layer.parent;
    if (!(dataLayerSet instanceof DashboardDataLayerSet)) {
      return;
    }

    annotationEditActions.removeAnnotation({
      source: dataLayerSet,
      removedObject: this.layer,
    });
  }
}
