/* eslint-disable @grafana/i18n/no-translation-top-level */

import { t } from '@grafana/i18n';
import { dataLayers, SceneVariable } from '@grafana/scenes';

import { dashboardEditActions, makeEditAction } from '../../edit-pane/shared';
import { DashboardAnnotationsDataLayer } from '../../scene/DashboardAnnotationsDataLayer';
import { DashboardDataLayerSet } from '../../scene/DashboardDataLayerSet';

export interface AddAnnotationActionHelperProps {
  addedObject: dataLayers.AnnotationsDataLayer | DashboardAnnotationsDataLayer;
  source: DashboardDataLayerSet;
}

export interface RemoveAnnotationActionHelperProps {
  removedObject: dataLayers.AnnotationsDataLayer | DashboardAnnotationsDataLayer;
  source: DashboardDataLayerSet;
}

export const annotationEditActions = {
  addAnnotation({ source, addedObject }: AddAnnotationActionHelperProps) {
    const layersBeforeAddition = [...source.state.annotationLayers];

    dashboardEditActions.addElement({
      source,
      addedObject,
      perform() {
        source.setState({ annotationLayers: [...layersBeforeAddition, addedObject] });
      },
      undo() {
        source.setState({ annotationLayers: layersBeforeAddition });
      },
    });
  },
  removeAnnotation({ source, removedObject }: RemoveAnnotationActionHelperProps) {
    const layersBeforeRemoval = [...source.state.annotationLayers];

    dashboardEditActions.removeElement({
      source,
      removedObject,
      perform() {
        source.setState({ annotationLayers: layersBeforeRemoval.filter((layer) => layer !== removedObject) });
      },
      undo() {
        source.setState({ annotationLayers: layersBeforeRemoval });
      },
    });
  },
  // changeAnnotationName: makeEditAction<SceneVariable, 'name'>({
  //   description: t('dashboard.annotation.name.action', 'Change annotation name'),
  //   prop: 'name',
  // }),
  // changeVariableLabel: makeEditAction<SceneVariable, 'label'>({
  //   description: t('dashboard.variable.label.action', 'Change variable label'),
  //   prop: 'label',
  // }),
  // changeVariableDescription: makeEditAction<SceneVariable, 'description'>({
  //   description: t('dashboard.variable.description.action', 'Change variable description'),
  //   prop: 'description',
  // }),
  // changeVariableHideValue({ source, oldValue, newValue }: EditActionProps<SceneVariable, 'hide'>) {
  //   const variableSet = source.parent;
  //   const variablesBeforeChange =
  //     variableSet instanceof SceneVariableSet ? [...(variableSet.state.variables ?? [])] : undefined;

  //   dashboardEditActions.edit({
  //     description: t('dashboard.variable.hide.action', 'Change variable hide option'),
  //     source,
  //     perform: () => {
  //       source.setState({ hide: newValue });
  //       // Updating the variables set since components that show/hide variables subscribe to the variable set, not the individual variables.
  //       if (variableSet instanceof SceneVariableSet) {
  //         variableSet.setState({ variables: [...(variableSet.state.variables ?? [])] });
  //       }
  //     },
  //     undo: () => {
  //       source.setState({ hide: oldValue });
  //       if (variableSet instanceof SceneVariableSet && variablesBeforeChange) {
  //         variableSet.setState({ variables: variablesBeforeChange });
  //       }
  //     },
  //   });
  // },
};
