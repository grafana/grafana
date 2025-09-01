import { uniq, without } from 'lodash';

import {
  SceneComponentProps,
  SceneObjectBase,
  SceneObjectRef,
  SceneObjectState,
  sceneGraph,
  sceneUtils,
} from '@grafana/scenes';

import { Workbench } from '../Workbench';
import {
  AlertRuleQueryData,
  AlertRuleRow,
  Domain,
  Filter,
  GenericGroupedRow,
  TimelineEntry,
  WorkbenchRow,
} from '../types';

import { getAlertInstanceScene, getAlertRuleScene } from './AlertInstanceScene';

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

  public getGroupByKeys(): string[] {
    const groupBy = sceneGraph.getVariables(this).getByName('groupBy');

    if (groupBy && sceneUtils.isGroupByVariable(groupBy)) {
      const groupByValue = groupBy.getValue();

      if (Array.isArray(groupByValue)) {
        return groupByValue.filter((key): key is string => typeof key === 'string');
      }
    }

    return [];
  }
}

export function WorkbenchRenderer({ model }: SceneComponentProps<WorkbenchSceneObject>) {
  const $timeRange = sceneGraph.getTimeRange(model).useState();
  const $data = sceneGraph.getData(model).useState();

  const groupByKeys = model.getGroupByKeys();
  let data: WorkbenchRow[] = [];

  if ($data?.data?.series?.length ?? 0 > 0) {
    data = convertToWorkbenchRows($data as unknown as AlertRuleQueryData, groupByKeys);
  }

  // convert timeRange to a domain for the workbench
  // @TODO why can't the types infer timerange is not undefined?
  const domain: Domain = [$timeRange.value.from.toDate(), $timeRange.value.to.toDate()];

  return <Workbench data={data} domain={domain} />;
}

export function convertToWorkbenchRows(data: AlertRuleQueryData, groupBy: string[] = []): WorkbenchRow[] {
  const series = data.data.series[0];
  const fields = series.fields;

  // Find required fields
  const timeField = fields.find((f) => f.name === 'Time');
  const alertnameField = fields.find((f) => f.name === 'alertname');
  const alertstateField = fields.find((f) => f.name === 'alertstate');
  const folderField = fields.find((f) => f.name === 'grafana_folder');
  const ruleUidField = fields.find((f) => f.name === 'grafana_rule_uid');

  if (!timeField || !alertnameField || !alertstateField || !folderField || !ruleUidField) {
    return [];
  }

  // Create a map of all available fields for grouping
  const fieldMap = new Map<string, any>();
  fields.forEach((field) => {
    fieldMap.set(field.name, field);
  });

  // Collect all data with their field values
  const allDataPoints: Array<{
    timestamp: number;
    alertname: string;
    alertstate: 'firing' | 'pending';
    folder: string;
    ruleUID: string;
    fieldValues: Map<string, any>;
  }> = [];

  for (let i = 0; i < timeField.values.length; i++) {
    const fieldValues = new Map<string, any>();

    // Collect all field values for this data point
    fields.forEach((field) => {
      fieldValues.set(field.name, field.values[i]);
    });

    allDataPoints.push({
      timestamp: timeField.values[i] as number,
      alertname: alertnameField.values[i] as string,
      alertstate: alertstateField.values[i] as 'firing' | 'pending',
      folder: folderField.values[i] as string,
      ruleUID: ruleUidField.values[i] as string,
      fieldValues,
    });
  }

  // If no grouping is specified, return the original flat structure
  if (groupBy.length === 0) {
    return createAlertRuleRowsFromDataPoints(allDataPoints);
  }

  // Build hierarchical structure based on groupBy
  return buildHierarchicalGroups(allDataPoints, groupBy, 0);
}

/**
 * Deduplicates data points by timestamp, ensuring that 'firing' state takes precedence over 'pending' state.
 *
 * @param dataPoints Array of data points with timestamp and state
 * @returns Map where keys are timestamps and values are the final state for that timestamp
 */
function convertDataPointsToTimeline(
  dataPoints: Array<{ timestamp: number; state: 'firing' | 'pending' }>
): TimelineEntry[] {
  const timestampStateMap = new Map<number, 'firing' | 'pending'>();

  dataPoints.forEach((dataPoint) => {
    const { timestamp, state } = dataPoint;
    const existingState = timestampStateMap.get(timestamp);

    // Set the state if:
    // 1. No state exists for this timestamp yet, OR
    // 2. Current state is 'firing' and existing state is 'pending' (firing takes precedence)
    const shouldUpdateState = !existingState || (state === 'firing' && existingState === 'pending');

    if (shouldUpdateState) {
      timestampStateMap.set(timestamp, state);
    }
  });

  // Create timeline as array of [timestamp, state] tuples, sorted by time
  const timeline: TimelineEntry[] = Array.from(timestampStateMap.entries()).sort(
    ([timestampA], [timestampB]) => timestampA - timestampB
  );

  return timeline;
}

export function createAlertRuleRowsFromDataPoints(
  dataPoints: Array<{
    timestamp: number;
    alertname: string;
    alertstate: 'firing' | 'pending';
    folder: string;
    ruleUID: string;
    fieldValues: Map<string, any>;
  }>
): AlertRuleRow[] {
  // Group data points by rule UID
  const ruleGroups = new Map<
    string,
    {
      alertname: string;
      folder: string;
      ruleUID: string;
      dataPoints: Array<{ timestamp: number; state: 'firing' | 'pending' }>;
    }
  >();

  dataPoints.forEach((dp) => {
    if (!ruleGroups.has(dp.ruleUID)) {
      ruleGroups.set(dp.ruleUID, {
        alertname: dp.alertname,
        folder: dp.folder,
        ruleUID: dp.ruleUID,
        dataPoints: [],
      });
    }

    ruleGroups.get(dp.ruleUID)!.dataPoints.push({
      timestamp: dp.timestamp,
      state: dp.alertstate,
    });
  });

  // Convert to AlertRuleRow format
  const alertRuleRows: AlertRuleRow[] = [];

  for (const [_ruleUID, group] of ruleGroups) {
    // Deduplicate data points by timestamp, with firing state taking precedence over pending
    const timeline = convertDataPointsToTimeline(group.dataPoints);

    const alertRuleRow: AlertRuleRow = {
      metadata: {
        title: group.alertname,
        folder: group.folder,
        ruleUID: group.ruleUID,
      },
      timeline,
      rowSummaryScene: new SceneObjectRef(getAlertRuleScene(group.ruleUID)).resolve(),
      instancesScene: getAlertInstanceScene(group.ruleUID),
      rows: [],
    };

    alertRuleRows.push(alertRuleRow);
  }

  return alertRuleRows;
}

export function buildHierarchicalGroups(
  dataPoints: Array<{
    timestamp: number;
    alertname: string;
    alertstate: 'firing' | 'pending';
    folder: string;
    ruleUID: string;
    fieldValues: Map<string, any>;
  }>,
  groupBy: string[],
  currentDepth: number
): WorkbenchRow[] {
  // If we've reached the end of groupBy array, create AlertRuleRows
  if (currentDepth >= groupBy.length) {
    return createAlertRuleRowsFromDataPoints(dataPoints);
  }

  const currentGroupField = groupBy[currentDepth];

  // Group data points by the current field value
  const groups = new Map<string, typeof dataPoints>();

  dataPoints.forEach((dp) => {
    const groupValue = dp.fieldValues.get(currentGroupField);
    const groupKey = String(groupValue ?? 'undefined');

    if (!groups.has(groupKey)) {
      groups.set(groupKey, []);
    }
    groups.get(groupKey)!.push(dp);
  });

  // Create GenericGroupedRow for each group
  const result: WorkbenchRow[] = [];

  for (const [groupValue, groupDataPoints] of groups) {
    // Recursively build the next level
    const childRows = buildHierarchicalGroups(groupDataPoints, groupBy, currentDepth + 1);

    const genericGroupedRow: GenericGroupedRow = {
      metadata: {
        label: currentGroupField,
        value: groupValue,
      },
      rows: childRows,
    };

    result.push(genericGroupedRow);
  }

  return result;
}
