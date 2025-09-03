import {
  AdHocFiltersVariable,
  GroupByVariable,
  SceneControlsSpacer,
  SceneFlexItem,
  SceneFlexLayout,
  SceneRefreshPicker,
  SceneTimePicker,
  SceneTimeRange,
  SceneVariableSet,
  VariableValueSelectors,
} from '@grafana/scenes';
import { EmbeddedSceneWithContext } from '@grafana/scenes-react';

import { SummaryChartScene } from './SummaryChart';
import { WorkbenchSceneObject } from './Workbench';
import { DS_UID, defaultTimeRange } from './utils';

export const triageScene = new EmbeddedSceneWithContext({
  $behaviors: [],
  controls: [
    new VariableValueSelectors({}),
    new SceneControlsSpacer(),
    new SceneTimePicker({}),
    new SceneRefreshPicker({}),
  ],
  $timeRange: new SceneTimeRange(defaultTimeRange),
  $variables: new SceneVariableSet({
    variables: [
      new GroupByVariable({
        name: 'groupBy',
        label: 'Group by',
        datasource: {
          type: 'prometheus',
          uid: DS_UID,
        },
        allowCustomValue: true,
        applyMode: 'auto',
      }),
      new AdHocFiltersVariable({
        name: 'filters',
        label: 'Filters',
        datasource: {
          type: 'prometheus',
          uid: DS_UID,
        },
        applyMode: 'manual', // we will construct the label matchers for the PromQL queries ourselves
        allowCustomValue: true,
        useQueriesAsFilterForOptions: true,
        supportsMultiValueOperators: true,
        filters: [],
        baseFilters: [],
        layout: 'combobox',
      }),
    ],
  }),
  body: new SceneFlexLayout({
    direction: 'column',
    children: [
      // this is the summary bar chart we show above the workbench
      new SceneFlexItem({
        height: 250,
        body: new SummaryChartScene({}),
      }),
      // this is the main workbench component
      new WorkbenchSceneObject({}),
    ],
  }),
});

export const TriageScene = () => <triageScene.Component model={triageScene} />;
