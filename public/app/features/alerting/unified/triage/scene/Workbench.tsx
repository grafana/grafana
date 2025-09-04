import { DataFrame, PanelData } from '@grafana/data';
import { SceneObjectBase, SceneObjectState } from '@grafana/scenes';
import { useQueryRunner, useTimeRange, useVariableValues } from '@grafana/scenes-react';

import { Workbench } from '../Workbench';
import { AlertRuleRow, GenericGroupedRow, WorkbenchRow } from '../types';

import { DEFAULT_FIELDS, METRIC_NAME, VARIABLES } from './constants';
import { convertTimeRangeToDomain, getDataQuery, useQueryFilter } from './utils';

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

function createAlertRuleRows(dataPoints: Array<Record<string, any>>): AlertRuleRow[] {
  const rules = new Map<
    string,
    {
      alertname: string;
      folder: string;
      ruleUID: string;
    }
  >();

  for (const dp of dataPoints) {
    const ruleUID = dp.grafana_rule_uid;
    if (!rules.has(ruleUID)) {
      rules.set(ruleUID, {
        alertname: dp.alertname,
        folder: dp.grafana_folder,
        ruleUID: ruleUID,
      });
    }
  }

  const result: AlertRuleRow[] = [];
  for (const rule of rules.values()) {
    result.push({
      metadata: {
        title: rule.alertname,
        folder: rule.folder,
        ruleUID: rule.ruleUID,
      },
    });
  }
  return result;
}

function groupData(dataPoints: Array<Record<string, unknown>>, groupBy: string[], depth: number): WorkbenchRow[] {
  if (depth >= groupBy.length) {
    return createAlertRuleRows(dataPoints);
  }

  const groupByKey = groupBy[depth];
  const grouped = new Map<string, Array<Record<string, any>>>();

  for (const dp of dataPoints) {
    const key = String(dp[groupByKey] ?? 'undefined');
    if (!grouped.has(key)) {
      grouped.set(key, []);
    }
    grouped.get(key)?.push(dp);
  }

  const result: GenericGroupedRow[] = [];
  for (const [value, rows] of grouped.entries()) {
    result.push({
      metadata: {
        label: groupByKey,
        value: value,
      },
      rows: groupData(rows, groupBy, depth + 1),
    });
  }

  return result;
}

// @TODO narrower types for PanelData! (if possible)
export function convertToWorkbenchRows(data: PanelData, groupBy: string[] = []): WorkbenchRow[] {
  if (!data.series.at(0)?.fields.length) {
    return [];
  }

  const frame = data.series[0];
  if (!isValidFrame(frame)) {
    return [];
  }

  const allDataPoints = Array.from({ length: frame.length }, (_, i) =>
    frame.fields.reduce<Record<string, unknown>>((acc, field) => {
      acc[field.name] = field.values[i];
      return acc;
    }, {})
  );

  return groupData(allDataPoints, groupBy, 0);
}

function isValidFrame(frame: DataFrame) {
  const requiredFieldNames = ['Time', ...DEFAULT_FIELDS];
  const fieldNames = new Set(frame.fields.map((f) => f.name));
  return requiredFieldNames.every((name) => fieldNames.has(name));
}
