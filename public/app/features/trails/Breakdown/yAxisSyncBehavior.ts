import { BusEventWithPayload } from '@grafana/data';
import {
  FieldConfigBuilders,
  SceneCSSGridItem,
  SceneDataProvider,
  sceneGraph,
  SceneStatelessBehavior,
  VizPanel,
} from '@grafana/scenes';

import { LabelBreakdownScene } from './LabelBreakdownScene';
import { findSceneObjectsByType } from './utils';

export class BreakdownAxisChangeEvent extends BusEventWithPayload<{ min: number; max: number }> {
  public static type = 'selected-metric-query-results-event';
}

export const yAxisSyncBehavior: SceneStatelessBehavior = (sceneObject: SceneCSSGridItem) => {
  const breakdownScene = sceneGraph.getAncestor(sceneObject, LabelBreakdownScene);

  // Handle query runners from vizPanels that haven't been activated yet
  findSceneObjectsByType(sceneObject, VizPanel).forEach((vizPanel) => {
    if (vizPanel.isActive) {
      registerDataProvider(vizPanel.state.$data);
    } else {
      vizPanel.addActivationHandler(() => {
        registerDataProvider(vizPanel.state.$data);
      });
    }
  });

  // Register the data providers of all present vizpanels
  findSceneObjectsByType(sceneObject, VizPanel).forEach((vizPanel) => registerDataProvider(vizPanel.state.$data));

  function registerDataProvider(dataProvider?: SceneDataProvider) {
    if (!dataProvider) {
      return;
    }

    if (!dataProvider.isActive) {
      dataProvider.addActivationHandler(() => {
        // Call this function again when the dataprovider is activated
        registerDataProvider(dataProvider);
      });
    }

    // Report the panel data if it is already populated
    if (dataProvider.state.data) {
      breakdownScene.reportBreakdownPanelData(dataProvider.state.data);
    }

    // Report the panel data whenever it is updated
    dataProvider.subscribeToState(({ data }, _) => {
      breakdownScene.reportBreakdownPanelData(data);
    });
  }

  const axisChangeSubscription = breakdownScene.subscribeToEvent(BreakdownAxisChangeEvent, (event) => {
    if (!sceneObject.isActive) {
      axisChangeSubscription.unsubscribe();
      return;
    }

    const fieldConfig = FieldConfigBuilders.timeseries()
      .setCustomFieldConfig('axisSoftMin', event.payload.min)
      .setCustomFieldConfig('axisSoftMax', event.payload.max)
      .build();

    findSceneObjectsByType(sceneObject, VizPanel).forEach((vizPanel) => {
      function update() {
        vizPanel.onFieldConfigChange(fieldConfig);
      }

      if (vizPanel.isActive) {
        // Update axis for panels that are already active
        update();
      } else {
        // Update inactive panels once they become active.
        vizPanel.addActivationHandler(update);
      }
    });
  });
};
