import React from 'react';

import {
  EmbeddedScene,
  PanelBuilders,
  SceneControlsSpacer,
  SceneFlexItem,
  SceneFlexLayout,
  SceneQueryRunner,
  SceneRefreshPicker,
  SceneTimePicker,
  SceneTimeRange,
  SceneVariableSet,
  TextBoxVariable,
  VariableValueSelectors,
  useUrlSync,
} from '@grafana/scenes';
import { GraphDrawStyle, VisibilityMode } from '@grafana/schema/dist/esm/index';
import {
  GraphGradientMode,
  LegendDisplayMode,
  LineInterpolation,
  ScaleDistribution,
  StackingMode,
  TooltipDisplayMode,
} from '@grafana/ui';

import { DataSourceInformation } from '../../../home/Insights';

import { HistoryEventsListObject } from './CentralAlertHistory';
import { alertStateHistoryDatasource, useRegisterHistoryRuntimeDataSource } from './CentralHistoryRuntimeDataSource';

export const LABELS_FILTER = 'filter';
/**
 *
 * This scene shows the history of the alert state changes.
 * It shows a timeseries panel with the alert state changes and a list of the events.
 * The events in the panel are fetched from the history api, through a runtime datasource.
 * The events in the list are fetched direclty from the history api.
 * Main scene renders two children scene objects, one for the timeseries panel and one for the list of events.
 * Both share time range and filter variable from the parent scene.
 */

export const CentralAlertHistoryScene = () => {
  const filterVariable = new TextBoxVariable({
    name: LABELS_FILTER,
    label: 'Filter events with labels',
    description: 'Filter events in the events chart and in the list with labels',
  });

  useRegisterHistoryRuntimeDataSource(); // register the runtime datasource for the history api.

  const scene = new EmbeddedScene({
    controls: [
      new VariableValueSelectors({}),
      new SceneControlsSpacer(),
      new SceneTimePicker({}),
      new SceneRefreshPicker({}),
    ],
    $timeRange: new SceneTimeRange({}), //needed for using the time range sync in the url
    $variables: new SceneVariableSet({
      variables: [filterVariable],
    }),
    body: new SceneFlexLayout({
      direction: 'column',
      children: [
        new SceneFlexItem({
          ySizing: 'content',
          body: getEventsSceneObject(alertStateHistoryDatasource),
        }),
        new SceneFlexItem({
          body: new HistoryEventsListObject(),
        }),
      ],
    }),
  });
  // we need to call this to sync the url with the scene state
  const isUrlSyncInitialized = useUrlSync(scene);

  if (!isUrlSyncInitialized) {
    return null;
  }

  return <scene.Component model={scene} />;
};

function getEventsSceneObject(ashDs: DataSourceInformation) {
  return new EmbeddedScene({
    controls: [],
    body: new SceneFlexLayout({
      direction: 'column',
      children: [
        new SceneFlexItem({
          ySizing: 'content',
          body: new SceneFlexLayout({
            children: [getEventsScenesFlexItem(ashDs)],
          }),
        }),
      ],
    }),
  });
}

function getSceneQuery(datasource: DataSourceInformation) {
  const query = new SceneQueryRunner({
    datasource: datasource,
    queries: [
      {
        refId: 'A',
        expr: '',
        queryType: 'range',
        step: '10s',
      },
    ],
  });
  return query;
}
/**
 * This function creates a SceneFlexItem with a timeseries panel that shows the events.
 * The query uses a runtime datasource that fetches the events from the history api.
 */
export function getEventsScenesFlexItem(datasource: DataSourceInformation) {
  return new SceneFlexItem({
    minHeight: 300,
    body: PanelBuilders.timeseries()
      .setTitle('Events')
      .setDescription('Alert events during the period of time.')
      .setData(getSceneQuery(datasource))
      .setColor({ mode: 'continuous-BlPu' })
      .setCustomFieldConfig('fillOpacity', 100)
      .setCustomFieldConfig('drawStyle', GraphDrawStyle.Bars)
      .setCustomFieldConfig('lineInterpolation', LineInterpolation.Linear)
      .setCustomFieldConfig('lineWidth', 1)
      .setCustomFieldConfig('barAlignment', 0)
      .setCustomFieldConfig('spanNulls', false)
      .setCustomFieldConfig('insertNulls', false)
      .setCustomFieldConfig('showPoints', VisibilityMode.Auto)
      .setCustomFieldConfig('pointSize', 5)
      .setCustomFieldConfig('stacking', { mode: StackingMode.None, group: 'A' })
      .setCustomFieldConfig('gradientMode', GraphGradientMode.Hue)
      .setCustomFieldConfig('scaleDistribution', { type: ScaleDistribution.Linear })
      .setOption('legend', { showLegend: false, displayMode: LegendDisplayMode.Hidden })
      .setOption('tooltip', { mode: TooltipDisplayMode.Single })

      .setNoValue('No events found')
      .build(),
  });
}
