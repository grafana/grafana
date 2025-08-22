import {
  EmbeddedScene,
  SceneControlsSpacer,
  SceneFlexItem,
  SceneFlexLayout,
  SceneRefreshPicker,
  SceneTimePicker,
  SceneTimeRange,
} from '@grafana/scenes';

import { summaryChart } from './SummaryChart';
import { WorkbenchSceneObject } from './Workbench';
import { DEFAULT_FIELDS, METRIC_NAME, defaultTimeRange, getQueryRunner } from './utils';

const groupedByAlertname = getQueryRunner(`count by (${DEFAULT_FIELDS.join(',')}) (${METRIC_NAME}{})`, {
  format: 'table',
});

export const triageScene = new EmbeddedScene({
  controls: [new SceneControlsSpacer(), new SceneTimePicker({}), new SceneRefreshPicker({})],
  $data: groupedByAlertname,
  $timeRange: new SceneTimeRange(defaultTimeRange),
  body: new SceneFlexLayout({
    direction: 'column',
    children: [
      // this is the summary bar chart we show above the workbench
      new SceneFlexItem({
        minHeight: 250,
        body: summaryChart,
      }),
      // this is the main workbench component
      new WorkbenchSceneObject({}),
    ],
  }),
});

export const TriageScene = () => <triageScene.Component model={triageScene} />;
