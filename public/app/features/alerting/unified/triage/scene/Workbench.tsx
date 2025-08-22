import { uniq, without } from 'lodash';

import { SceneComponentProps, SceneObjectBase, SceneObjectState, sceneGraph } from '@grafana/scenes';

import { Workbench } from '../Workbench';
import { AlertRuleQueryData, AlertRuleRow, Domain, Filter, WorkbenchRow } from '../types';

interface WorkbenchState extends SceneObjectState {
  groupBy: string[];
  filterBy: Filter[];
}

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

export function WorkbenchRenderer({ model }: SceneComponentProps<WorkbenchSceneObject>) {
  const { filterBy, groupBy } = model.useState();

  const $timeRange = sceneGraph.getTimeRange(model).useState();
  const $data = sceneGraph.getData(model).useState();

  let data: WorkbenchRow[] = [];

  console.log($data);
  if ($data?.data?.series?.length ?? 0 > 0) {
    data = convertToWorkbenchRows($data);
    console.log(data);
  }

  // convert timeRange to a domain for the workbench
  // @TODO why can't the types infer timerange is not undefined?
  const domain: Domain = [$timeRange.value.from.toDate(), $timeRange.value.to.toDate()];

  return <Workbench data={data} domain={domain} groupBy={groupBy} filterBy={filterBy} />;
}

function convertToWorkbenchRows(data: AlertRuleQueryData): WorkbenchRow[] {
  const series = data.data.series[0];
  const fields = series.fields;

  // Find field indices
  const timeField = fields.find((f) => f.name === 'Time');
  const alertnameField = fields.find((f) => f.name === 'alertname');
  const alertstateField = fields.find((f) => f.name === 'alertstate');
  const folderField = fields.find((f) => f.name === 'grafana_folder');
  const ruleUidField = fields.find((f) => f.name === 'grafana_rule_uid');

  if (!timeField || !alertnameField || !alertstateField || !folderField || !ruleUidField) {
    return [];
  }

  // Group data by rule UID
  const ruleGroups = new Map<
    string,
    {
      alertname: string;
      folder: string;
      ruleUID: string;
      dataPoints: Array<{ timestamp: number; state: 'firing' | 'pending' }>;
    }
  >();

  // Process each data point
  for (let i = 0; i < timeField.values.length; i++) {
    const timestamp = timeField.values[i] as number;
    const alertname = alertnameField.values[i] as string;
    const alertstate = alertstateField.values[i] as 'firing' | 'pending';
    const folder = folderField.values[i] as string;
    const ruleUID = ruleUidField.values[i] as string;

    if (!ruleGroups.has(ruleUID)) {
      ruleGroups.set(ruleUID, {
        alertname,
        folder,
        ruleUID,
        dataPoints: [],
      });
    }

    ruleGroups.get(ruleUID)!.dataPoints.push({
      timestamp,
      state: alertstate,
    });
  }

  // Convert to WorkbenchRow format
  const workbenchRows: WorkbenchRow[] = [];

  for (const [_ruleUID, group] of ruleGroups) {
    // Create timeline from data points
    const timeline: Array<[number, 'firing' | 'pending']> = group.dataPoints.map((dp) => [dp.timestamp, dp.state]);

    const alertRuleRow: AlertRuleRow = {
      metadata: {
        title: group.alertname,
        folder: group.folder,
        ruleUID: group.ruleUID,
      },
      timeline: timeline,
      rows: [],
    };

    workbenchRows.push(alertRuleRow);
  }

  return workbenchRows;
}
