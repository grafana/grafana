import { PanelData } from '@grafana/data';
import { SceneObjectBase, SceneObjectState } from '@grafana/scenes';
import { useQueryRunner, useTimeRange, useVariableValues } from '@grafana/scenes-react';

import { Workbench } from '../Workbench';
import { AlertRuleRow, GenericGroupedRow, WorkbenchRow } from '../types';

import { VARIABLES } from './constants';
import { DEFAULT_FIELDS, METRIC_NAME, convertTimeRangeToDomain, getDataQuery, useQueryFilter } from './utils';

export class WorkbenchSceneObject extends SceneObjectBase<SceneObjectState> {
  public static Component = WorkbenchRenderer;
}

export function WorkbenchRenderer() {
  const [timeRange] = useTimeRange();
  const domain = convertTimeRangeToDomain(timeRange);

  const [groupByKeys = []] = useVariableValues<string>(VARIABLES.groupBy);

  const countBy = DEFAULT_FIELDS.concat(groupByKeys).join(',');
  const queryFilter = useQueryFilter();

  const runner = useQueryRunner({
    queries: [
      getDataQuery(`count by (${countBy}) (${METRIC_NAME}{${queryFilter}})`, {
        format: 'table',
      }),
    ],
  });
  const { data } = runner.useState();
  const rows = data ? convertToWorkbenchRows(data, groupByKeys) : [];

  return <Workbench data={rows} domain={domain} />;
}

// @TODO narrower types for PanelData! (if possible)
export function convertToWorkbenchRows(data: PanelData, groupBy: string[] = []): WorkbenchRow[] {
  // @TODO don't know why we need this but seems to crash sometimes
  if (!data.series.at(0)?.fields) {
    return [];
  }

  const series = data.series[0];
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
    const alertRuleRow: AlertRuleRow = {
      metadata: {
        title: group.alertname,
        folder: group.folder,
        ruleUID: group.ruleUID,
      },
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
