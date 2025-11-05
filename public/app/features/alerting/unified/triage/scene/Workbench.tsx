import { isEmpty } from 'lodash';
import { ArrayValues } from 'type-fest';

import { DataFrame, PanelData } from '@grafana/data';
import { SceneObjectBase, SceneObjectState } from '@grafana/scenes';
import { useQueryRunner, useTimeRange, useVariableValues } from '@grafana/scenes-react';

import { Workbench } from '../Workbench';
import { DEFAULT_FIELDS, METRIC_NAME, VARIABLES } from '../constants';
import { AlertRuleRow, EmptyLabelValue, GenericGroupedRow, WorkbenchRow } from '../types';

import { convertTimeRangeToDomain, getDataQuery, useQueryFilter } from './utils';

export class WorkbenchSceneObject extends SceneObjectBase<SceneObjectState> {
  public static Component = WorkbenchRenderer;
}

export function WorkbenchRenderer() {
  const [timeRange] = useTimeRange();
  const domain = convertTimeRangeToDomain(timeRange);

  const [groupByKeys = []] = useVariableValues<string>(VARIABLES.groupBy);

  const countBy = [...DEFAULT_FIELDS, ...groupByKeys].join(',');
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

  const hasFiltersApplied = queryFilter.length > 0;

  return (
    <Workbench
      data={rows}
      domain={domain}
      queryRunner={runner}
      groupBy={groupByKeys}
      hasActiveFilters={hasFiltersApplied}
    />
  );
}

type DataPoint = Record<ArrayValues<typeof DEFAULT_FIELDS>, string> & Record<string, string | undefined>;

function createAlertRuleRows(dataPoints: DataPoint[]): AlertRuleRow[] {
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
      type: 'alertRule',
      metadata: {
        title: rule.alertname,
        folder: rule.folder,
        ruleUID: rule.ruleUID,
      },
    });
  }
  return result;
}

function groupData(dataPoints: DataPoint[], groupBy: string[], depth: number): WorkbenchRow[] {
  if (depth >= groupBy.length) {
    return createAlertRuleRows(dataPoints);
  }

  const groupByKey = groupBy[depth];
  const grouped = new Map<string | typeof EmptyLabelValue, DataPoint[]>();

  for (const dp of dataPoints) {
    const mapKey = dp[groupByKey] ?? EmptyLabelValue;
    if (!grouped.has(mapKey)) {
      grouped.set(mapKey, []);
    }
    grouped.get(mapKey)?.push(dp);
  }

  const result: GenericGroupedRow[] = [];
  const emptyGroups: GenericGroupedRow[] = [];

  for (const [value, rows] of grouped.entries()) {
    const labelValue = isEmpty(value) ? EmptyLabelValue : value;

    const group: GenericGroupedRow = {
      type: 'group',
      metadata: {
        label: groupByKey,
        value: labelValue,
      },
      rows: groupData(rows, groupBy, depth + 1),
    };

    // Separate empty label groups to append at the end
    if (group.metadata.value === EmptyLabelValue) {
      emptyGroups.push(group);
    } else {
      result.push(group);
    }
  }

  return [...result, ...emptyGroups];
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

  const allDataPoints = Array.from({ length: frame.length }, (_, i) => {
    const dataPoint: DataPoint = Object.create(null);
    frame.fields.forEach((field) => {
      dataPoint[field.name] = field.values[i];
    });
    return dataPoint;
  });

  return groupData(allDataPoints, groupBy, 0);
}

function isValidFrame(frame: DataFrame) {
  const requiredFieldNames = ['Time', ...DEFAULT_FIELDS];
  const fieldNames = new Set(frame.fields.map((f) => f.name));
  return requiredFieldNames.every((name) => fieldNames.has(name));
}
