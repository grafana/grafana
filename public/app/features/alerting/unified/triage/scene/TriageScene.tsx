import { uniq, without } from 'lodash';

import {
  EmbeddedScene,
  SceneComponentProps,
  SceneControlsSpacer,
  SceneFlexLayout,
  SceneObjectBase,
  SceneObjectState,
  SceneRefreshPicker,
  SceneTimePicker,
  SceneTimeRange,
  sceneGraph,
} from '@grafana/scenes';

import { Workbench } from '../Workbench';
import { Domain, Filter } from '../types';

import { summaryChart } from './SummaryChart';
import { METRIC_NAME, getQueryRunner } from './utils';

interface WorkbenchState extends SceneObjectState {
  groupBy: string[];
  filterBy: Filter[];
}

const defaultTimeRange = { from: 'now-1h', to: 'now' };

export class WorkbenchSceneObject extends SceneObjectBase<WorkbenchState> {
  public static Component = WorkbenchRenderer;

  constructor(state: Partial<WorkbenchState> = {}) {
    super({
      groupBy: [],
      filterBy: [],
      ...state,
    });
  }

  public addGroupByKey(key: string) {
    this.setState({
      groupBy: uniq([...this.state.groupBy, key]),
    });
  }

  public removeGroupByKey(key: string) {
    this.setState({
      groupBy: without(this.state.groupBy, key),
    });
  }

  // @TODO add functions for filters
}

const DEFAULT_FIELDS = ['alertname', 'grafana_folder', 'grafana_rule_uid', 'alertstate'];

export function WorkbenchRenderer({ model }: SceneComponentProps<WorkbenchSceneObject>) {
  const { filterBy, groupBy } = model.useState();
  const $timeRange = sceneGraph.getTimeRange(model).useState();

  // convert timeRange to a domain for the workbench
  // @TODO why can't the types infer timerange is not undefined?
  const domain: Domain = [$timeRange.value.from.toDate(), $timeRange.value.to.toDate()];
  console.log($timeRange);

  return <Workbench domain={domain} groupBy={groupBy} filterBy={filterBy} />;
}

const groupedByAlertname = getQueryRunner(`count by (${DEFAULT_FIELDS.join(',')}) (${METRIC_NAME}{})`);

export const triageScene = new EmbeddedScene({
  controls: [new SceneControlsSpacer(), new SceneTimePicker({}), new SceneRefreshPicker({})],
  $data: groupedByAlertname,
  $timeRange: new SceneTimeRange(defaultTimeRange),
  body: new SceneFlexLayout({
    direction: 'column',
    children: [
      // this is the summary bar chart we show above the workbench
      summaryChart,
      // this is the main workbench component
      new WorkbenchSceneObject({}),
    ],
  }),
});

export function TriageScene() {
  return <triageScene.Component model={triageScene} />;
}
