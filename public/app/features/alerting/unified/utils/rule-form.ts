import {
  DataQuery,
  DataSourceRef,
  getDefaultRelativeTimeRange,
  IntervalValues,
  rangeUtil,
  RelativeTimeRange,
  ScopedVars,
  TimeRange,
} from '@grafana/data';
import { getDataSourceSrv } from '@grafana/runtime';
import { ExpressionDatasourceRef } from '@grafana/runtime/src/utils/DataSourceWithBackend';
import { getNextRefIdChar } from 'app/core/utils/query';
import { DashboardModel, PanelModel } from 'app/features/dashboard/state';
import { ExpressionDatasourceUID } from 'app/features/expressions/ExpressionDatasource';
import { ExpressionQuery, ExpressionQueryType } from 'app/features/expressions/types';
import { RuleWithLocation } from 'app/types/unified-alerting';
import {
  AlertQuery,
  Annotations,
  GrafanaAlertStateDecision,
  Labels,
  PostableRuleGrafanaRuleDTO,
  RulerAlertingRuleDTO,
  RulerRecordingRuleDTO,
  RulerRuleDTO,
} from 'app/types/unified-alerting-dto';

import { EvalFunction } from '../../state/alertDef';
import { RuleFormType, RuleFormValues } from '../types/rule-form';

import { getRulesAccess } from './access-control';
import { Annotation } from './constants';
import { getDefaultOrFirstCompatibleDataSource, isGrafanaRulesSource } from './datasource';
import { arrayToRecord, recordToArray } from './misc';
import { isAlertingRulerRule, isGrafanaRulerRule, isRecordingRulerRule } from './rules';
import { parseInterval } from './time';

export const getDefaultFormValues = (): RuleFormValues => {
  const { canCreateGrafanaRules, canCreateCloudRules } = getRulesAccess();

  return Object.freeze({
    name: '',
    labels: [{ key: '', value: '' }],
    annotations: [
      { key: Annotation.summary, value: '' },
      { key: Annotation.description, value: '' },
      { key: Annotation.runbookURL, value: '' },
    ],
    dataSourceName: null,
    type: canCreateGrafanaRules ? RuleFormType.grafana : canCreateCloudRules ? RuleFormType.cloudAlerting : undefined, // viewers can't create prom alerts
    group: '',

    // grafana
    folder: null,
    queries: [],
    condition: '',
    noDataState: GrafanaAlertStateDecision.NoData,
    execErrState: GrafanaAlertStateDecision.Alerting,
    evaluateEvery: '1m',
    evaluateFor: '5m',

    // cortex / loki
    namespace: '',
    expression: '',
    forTime: 1,
    forTimeUnit: 'm',
  });
};

export function formValuesToRulerRuleDTO(values: RuleFormValues): RulerRuleDTO {
  const { name, expression, forTime, forTimeUnit, type } = values;
  if (type === RuleFormType.cloudAlerting) {
    return {
      alert: name,
      for: `${forTime}${forTimeUnit}`,
      annotations: arrayToRecord(values.annotations || []),
      labels: arrayToRecord(values.labels || []),
      expr: expression,
    };
  } else if (type === RuleFormType.cloudRecording) {
    return {
      record: name,
      labels: arrayToRecord(values.labels || []),
      expr: expression,
    };
  }
  throw new Error(`unexpected rule type: ${type}`);
}

function listifyLabelsOrAnnotations(item: Labels | Annotations | undefined): Array<{ key: string; value: string }> {
  return [...recordToArray(item || {}), { key: '', value: '' }];
}

export function formValuesToRulerGrafanaRuleDTO(values: RuleFormValues): PostableRuleGrafanaRuleDTO {
  const { name, condition, noDataState, execErrState, evaluateFor, queries } = values;
  if (condition) {
    return {
      grafana_alert: {
        title: name,
        condition,
        no_data_state: noDataState,
        exec_err_state: execErrState,
        data: queries,
      },
      for: evaluateFor,
      annotations: arrayToRecord(values.annotations || []),
      labels: arrayToRecord(values.labels || []),
    };
  }
  throw new Error('Cannot create rule without specifying alert condition');
}

export function rulerRuleToFormValues(ruleWithLocation: RuleWithLocation): RuleFormValues {
  const { ruleSourceName, namespace, group, rule } = ruleWithLocation;

  const defaultFormValues = getDefaultFormValues();
  if (isGrafanaRulesSource(ruleSourceName)) {
    if (isGrafanaRulerRule(rule)) {
      const ga = rule.grafana_alert;
      return {
        ...defaultFormValues,
        name: ga.title,
        type: RuleFormType.grafana,
        group: group.name,
        evaluateFor: rule.for || '0',
        evaluateEvery: group.interval || defaultFormValues.evaluateEvery,
        noDataState: ga.no_data_state,
        execErrState: ga.exec_err_state,
        queries: ga.data,
        condition: ga.condition,
        annotations: listifyLabelsOrAnnotations(rule.annotations),
        labels: listifyLabelsOrAnnotations(rule.labels),
        folder: { title: namespace, id: ga.namespace_id },
      };
    } else {
      throw new Error('Unexpected type of rule for grafana rules source');
    }
  } else {
    if (isAlertingRulerRule(rule)) {
      const alertingRuleValues = alertingRulerRuleToRuleForm(rule);

      return {
        ...defaultFormValues,
        ...alertingRuleValues,
        type: RuleFormType.cloudAlerting,
        dataSourceName: ruleSourceName,
        namespace,
        group: group.name,
      };
    } else if (isRecordingRulerRule(rule)) {
      const recordingRuleValues = recordingRulerRuleToRuleForm(rule);

      return {
        ...defaultFormValues,
        ...recordingRuleValues,
        type: RuleFormType.cloudRecording,
        dataSourceName: ruleSourceName,
        namespace,
        group: group.name,
      };
    } else {
      throw new Error('Unexpected type of rule for cloud rules source');
    }
  }
}

export function alertingRulerRuleToRuleForm(
  rule: RulerAlertingRuleDTO
): Pick<RuleFormValues, 'name' | 'forTime' | 'forTimeUnit' | 'expression' | 'annotations' | 'labels'> {
  const defaultFormValues = getDefaultFormValues();

  const [forTime, forTimeUnit] = rule.for
    ? parseInterval(rule.for)
    : [defaultFormValues.forTime, defaultFormValues.forTimeUnit];

  return {
    name: rule.alert,
    expression: rule.expr,
    forTime,
    forTimeUnit,
    annotations: listifyLabelsOrAnnotations(rule.annotations),
    labels: listifyLabelsOrAnnotations(rule.labels),
  };
}

export function recordingRulerRuleToRuleForm(
  rule: RulerRecordingRuleDTO
): Pick<RuleFormValues, 'name' | 'expression' | 'labels'> {
  return {
    name: rule.record,
    expression: rule.expr,
    labels: listifyLabelsOrAnnotations(rule.labels),
  };
}

export const getDefaultQueries = (): AlertQuery[] => {
  const dataSource = getDefaultOrFirstCompatibleDataSource();

  if (!dataSource) {
    return [getDefaultExpression('A')];
  }
  const relativeTimeRange = getDefaultRelativeTimeRange();

  return [
    {
      refId: 'A',
      datasourceUid: dataSource.uid,
      queryType: '',
      relativeTimeRange,
      model: {
        refId: 'A',
        hide: false,
      },
    },
    getDefaultExpression('B'),
  ];
};

const getDefaultExpression = (refId: string): AlertQuery => {
  const model: ExpressionQuery = {
    refId,
    hide: false,
    type: ExpressionQueryType.classic,
    datasource: {
      uid: ExpressionDatasourceUID,
      type: ExpressionDatasourceRef.type,
    },
    conditions: [
      {
        type: 'query',
        evaluator: {
          params: [3],
          type: EvalFunction.IsAbove,
        },
        operator: {
          type: 'and',
        },
        query: {
          params: ['A'],
        },
        reducer: {
          params: [],
          type: 'last',
        },
      },
    ],
    expression: 'A',
  };

  return {
    refId,
    datasourceUid: ExpressionDatasourceUID,
    queryType: '',
    model,
  };
};

const dataQueriesToGrafanaQueries = async (
  queries: DataQuery[],
  relativeTimeRange: RelativeTimeRange,
  scopedVars: ScopedVars | {},
  panelDataSourceRef?: DataSourceRef,
  maxDataPoints?: number,
  minInterval?: string
): Promise<AlertQuery[]> => {
  const result: AlertQuery[] = [];

  for (const target of queries) {
    const datasource = await getDataSourceSrv().get(target.datasource?.uid ? target.datasource : panelDataSourceRef);
    const dsRef = { uid: datasource.uid, type: datasource.type };

    const range = rangeUtil.relativeToTimeRange(relativeTimeRange);
    const { interval, intervalMs } = getIntervals(range, minInterval ?? datasource.interval, maxDataPoints);
    const queryVariables = {
      __interval: { text: interval, value: interval },
      __interval_ms: { text: intervalMs, value: intervalMs },
      ...scopedVars,
    };

    const interpolatedTarget = datasource.interpolateVariablesInQueries
      ? await datasource.interpolateVariablesInQueries([target], queryVariables)[0]
      : target;

    // expressions
    if (dsRef.uid === ExpressionDatasourceUID) {
      const newQuery: AlertQuery = {
        refId: interpolatedTarget.refId,
        queryType: '',
        relativeTimeRange,
        datasourceUid: ExpressionDatasourceUID,
        model: interpolatedTarget,
      };
      result.push(newQuery);
      // queries
    } else {
      const datasourceSettings = getDataSourceSrv().getInstanceSettings(dsRef);
      if (datasourceSettings && datasourceSettings.meta.alerting) {
        const newQuery: AlertQuery = {
          refId: interpolatedTarget.refId,
          queryType: interpolatedTarget.queryType ?? '',
          relativeTimeRange,
          datasourceUid: datasourceSettings.uid,
          model: {
            ...interpolatedTarget,
            maxDataPoints,
            intervalMs,
          },
        };
        result.push(newQuery);
      }
    }
  }
  return result;
};

export const panelToRuleFormValues = async (
  panel: PanelModel,
  dashboard: DashboardModel
): Promise<Partial<RuleFormValues> | undefined> => {
  const { targets } = panel;
  if (!panel.id || !dashboard.uid) {
    return undefined;
  }

  const relativeTimeRange = rangeUtil.timeRangeToRelative(rangeUtil.convertRawToRange(dashboard.time));
  const queries = await dataQueriesToGrafanaQueries(
    targets,
    relativeTimeRange,
    panel.scopedVars || {},
    panel.datasource ?? undefined,
    panel.maxDataPoints ?? undefined,
    panel.interval ?? undefined
  );
  // if no alerting capable queries are found, can't create a rule
  if (!queries.length || !queries.find((query) => query.datasourceUid !== ExpressionDatasourceUID)) {
    return undefined;
  }

  if (!queries.find((query) => query.datasourceUid === ExpressionDatasourceUID)) {
    queries.push(getDefaultExpression(getNextRefIdChar(queries.map((query) => query.model))));
  }

  const { folderId, folderTitle } = dashboard.meta;

  const formValues = {
    type: RuleFormType.grafana,
    folder:
      folderId && folderTitle
        ? {
            id: folderId,
            title: folderTitle,
          }
        : undefined,
    queries,
    name: panel.title,
    condition: queries[queries.length - 1].refId,
    annotations: [
      {
        key: Annotation.dashboardUID,
        value: dashboard.uid,
      },
      {
        key: Annotation.panelID,
        value: String(panel.id),
      },
    ],
  };
  return formValues;
};

export function getIntervals(range: TimeRange, lowLimit?: string, resolution?: number): IntervalValues {
  if (!resolution) {
    if (lowLimit && rangeUtil.intervalToMs(lowLimit) > 1000) {
      return {
        interval: lowLimit,
        intervalMs: rangeUtil.intervalToMs(lowLimit),
      };
    }
    return { interval: '1s', intervalMs: 1000 };
  }

  return rangeUtil.calculateInterval(range, resolution, lowLimit);
}
