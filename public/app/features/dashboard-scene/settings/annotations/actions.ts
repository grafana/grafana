import { t } from '@grafana/i18n';
import { dataLayers } from '@grafana/scenes';
import { AnnotationPanelFilter } from '@grafana/schema/dist/esm/index.gen';

import { dashboardEditActions } from '../../edit-pane/shared';
import { DashboardAnnotationsDataLayer } from '../../scene/DashboardAnnotationsDataLayer';
import { DashboardDataLayerSet } from '../../scene/DashboardDataLayerSet';

type DataLayer = dataLayers.AnnotationsDataLayer | DashboardAnnotationsDataLayer;

export const annotationEditActions = {
  addAnnotation({ source, addedObject }: { addedObject: DataLayer; source: DashboardDataLayerSet }) {
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
  removeAnnotation({ source, removedObject }: { removedObject: DataLayer; source: DashboardDataLayerSet }) {
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
  changeAnnotationName({ source, oldValue, newValue }: { source: DataLayer; oldValue: string; newValue: string }) {
    if (oldValue === newValue) {
      return;
    }

    dashboardEditActions.edit({
      description: t(
        'dashboard-scene.annotation-edit-actions.description.change-annotation-name',
        'Change annotation name'
      ),
      source,
      perform() {
        source.setState({
          name: newValue,
          query: {
            ...source.state.query,
            name: newValue,
          },
        });
      },
      undo() {
        source.setState({
          name: oldValue,
          query: {
            ...source.state.query,
            name: oldValue,
          },
        });
      },
    });
  },
  changeAnnotationEnabled({ source, oldValue, newValue }: { source: DataLayer; oldValue: boolean; newValue: boolean }) {
    dashboardEditActions.edit({
      description: t(
        'dashboard-scene.annotation-edit-actions.description.change-annotation-enabled-state',
        'Change annotation enabled state'
      ),
      source,
      perform() {
        source.setState({
          isEnabled: newValue,
          query: {
            ...source.state.query,
            enable: newValue,
          },
        });
      },
      undo() {
        source.setState({
          isEnabled: oldValue,
          query: {
            ...source.state.query,
            enable: oldValue,
          },
        });
      },
    });
  },
  changeAnnotationColor({ source, oldValue, newValue }: { source: DataLayer; oldValue: string; newValue: string }) {
    dashboardEditActions.edit({
      description: t(
        'dashboard-scene.annotation-edit-actions.description.change-annotation-color',
        'Change annotation color'
      ),
      source,
      perform() {
        source.setState({
          query: {
            ...source.state.query,
            iconColor: newValue,
          },
        });
        source.runLayer();
      },
      undo() {
        source.setState({
          query: {
            ...source.state.query,
            iconColor: oldValue,
          },
        });
        source.runLayer();
      },
    });
  },
  changeAnnotationControlsDisplay({
    source,
    oldValue,
    newValue,
  }: {
    source: DataLayer;
    oldValue: { isHidden: boolean; placement?: 'inControlsMenu' };
    newValue: { isHidden: boolean; placement?: 'inControlsMenu' };
  }) {
    const forceReRender = () => {
      // force parent DashboardDataLayerSet to update its state so components that filter
      // annotationLayers (like DashboardDataLayerControls and DashboardControlsMenu) re-render
      const dataLayerSet = source.parent;
      if (dataLayerSet instanceof DashboardDataLayerSet) {
        dataLayerSet.setState({ annotationLayers: [...dataLayerSet.state.annotationLayers] });
      }
    };

    dashboardEditActions.edit({
      description: t(
        'dashboard-scene.annotation-edit-actions.description.change-annotation-controls-display',
        'Change annotation controls display'
      ),
      source,
      perform() {
        source.setState({
          isHidden: newValue.isHidden,
          placement: newValue.placement,
          query: {
            ...source.state.query,
            hide: newValue.isHidden,
            placement: newValue.placement,
          },
        });
        forceReRender();
      },
      undo() {
        source.setState({
          isHidden: oldValue.isHidden,
          placement: oldValue.placement,
          query: {
            ...source.state.query,
            hide: oldValue.isHidden,
            placement: oldValue.placement,
          },
        });
        forceReRender();
      },
    });
  },
  changeAnnotationPanelFilter({
    source,
    oldValue,
    newValue,
  }: {
    source: DataLayer;
    oldValue?: AnnotationPanelFilter;
    newValue?: AnnotationPanelFilter;
  }) {
    dashboardEditActions.edit({
      description: t(
        'dashboard-scene.annotation-edit-actions.description.change-annotation-panel-filter',
        'Change annotation panel filter'
      ),
      source,
      perform() {
        source.setState({
          query: {
            ...source.state.query,
            filter: newValue,
          },
        });
        source.runLayer();
      },
      undo() {
        source.setState({
          query: {
            ...source.state.query,
            filter: oldValue,
          },
        });
        source.runLayer();
      },
    });
  },
};
