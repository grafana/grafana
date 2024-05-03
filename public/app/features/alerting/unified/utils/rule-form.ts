import { omit } from 'lodash';

import {
  DataQuery,
  DataSourceInstanceSettings,
  DataSourceRef,
  getDefaultRelativeTimeRange,
  IntervalValues,
  rangeUtil,
  RelativeTimeRange,
  ScopedVars,
  TimeRange,
} from '@grafana/data';
import { config, getDataSourceSrv } from '@grafana/runtime';
import { ExpressionDatasourceRef } from '@grafana/runtime/src/utils/DataSourceWithBackend';
import { sceneGraph, VizPanel } from '@grafana/scenes';
import { DataSourceJsonData } from '@grafana/schema';
import { getNextRefIdChar } from 'app/core/utils/query';
import { DashboardModel, PanelModel } from 'app/features/dashboard/state';
import {
  getDashboardSceneFor,
  getPanelIdForVizPanel,
  getQueryRunnerFor,
} from 'app/features/dashboard-scene/utils/utils';
import { ExpressionDatasourceUID, ExpressionQuery, ExpressionQueryType } from 'app/features/expressions/types';
import { LokiQuery } from 'app/plugins/datasource/loki/types';
import { PromQuery } from 'app/plugins/datasource/prometheus/types';
import { RuleWithLocation } from 'app/types/unified-alerting';
import {
  AlertDataQuery,
  AlertQuery,
  Annotations,
  GrafanaAlertStateDecision,
  GrafanaNotificationSettings,
  GrafanaRuleDefinition,
  Labels,
  PostableRuleGrafanaRuleDTO,
  RulerAlertingRuleDTO,
  RulerRecordingRuleDTO,
  RulerRuleDTO,
} from 'app/types/unified-alerting-dto';

import { EvalFunction } from '../../state/alertDef';
import { AlertManagerManualRouting, ContactPoint, RuleFormType, RuleFormValues } from '../types/rule-form';

import { getRulesAccess } from './access-control';
import { Annotation, defaultAnnotations } from './constants';
import { getDefaultOrFirstCompatibleDataSource, GRAFANA_RULES_SOURCE_NAME, isGrafanaRulesSource } from './datasource';
import { arrayToRecord, recordToArray } from './misc';
import { isAlertingRulerRule, isGrafanaRulerRule, isRecordingRulerRule } from './rules';
import { parseInterval } from './time';

export type PromOrLokiQuery = PromQuery | LokiQuery;

export const MINUTE = '1m';

export const MANUAL_ROUTING_KEY = 'grafana.alerting.manualRouting';

export const getDefaultFormValues = (): RuleFormValues => {
  const { canCreateGrafanaRules, canCreateCloudRules } = getRulesAccess();

  return Object.freeze({
    name: '',
    uid: '',
    labels: [{ key: '', value: '' }],
    annotations: defaultAnnotations,
    dataSourceName: null,
    type: canCreateGrafanaRules ? RuleFormType.grafana : canCreateCloudRules ? RuleFormType.cloudAlerting : undefined, // viewers can't create prom alerts
    group: '',

    // grafana
    folder: null,
    queries: [],
    recordingRulesQueries: [],
    condition: '',
    noDataState: GrafanaAlertStateDecision.NoData,
    execErrState: GrafanaAlertStateDecision.Error,
    evaluateFor: '5m',
    evaluateEvery: MINUTE,
    manualRouting: getDefautManualRouting(), // we default to true if the feature toggle is enabled and the user hasn't set local storage to false
    contactPoints: {},
    overrideGrouping: false,
    overrideTimings: false,
    muteTimeIntervals: [],

    // cortex / loki
    namespace: '',
    expression: '',
    forTime: 1,
    forTimeUnit: 'm',
  });
};

export const getDefautManualRouting = () => {
  // first check if feature toggle for simplified routing is enabled
  const simplifiedRoutingToggleEnabled = config.featureToggles.alertingSimplifiedRouting ?? false;
  if (!simplifiedRoutingToggleEnabled) {
    return false;
  }
  //then, check in local storage if the user has enabled simplified routing
  // if it's not set, we'll default to true
  const manualRouting = localStorage.getItem(MANUAL_ROUTING_KEY);
  return manualRouting !== 'false';
};

export function formValuesToRulerRuleDTO(values: RuleFormValues): RulerRuleDTO {
  const { name, expression, forTime, forTimeUnit, keepFiringForTime, keepFiringForTimeUnit, type } = values;
  if (type === RuleFormType.cloudAlerting) {
    let keepFiringFor: string | undefined;
    if (keepFiringForTime && keepFiringForTimeUnit) {
      keepFiringFor = `${keepFiringForTime}${keepFiringForTimeUnit}`;
    }

    return {
      alert: name,
      for: `${forTime}${forTimeUnit}`,
      keep_firing_for: keepFiringFor,
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

export function listifyLabelsOrAnnotations(
  item: Labels | Annotations | undefined,
  addEmpty: boolean
): Array<{ key: string; value: string }> {
  const list = [...recordToArray(item || {})];
  if (addEmpty) {
    list.push({ key: '', value: '' });
  }
  return list;
}

//make sure default annotations are always shown in order even if empty
export function normalizeDefaultAnnotations(annotations: Array<{ key: string; value: string }>) {
  const orderedAnnotations = [...annotations];
  const defaultAnnotationKeys = defaultAnnotations.map((annotation) => annotation.key);

  defaultAnnotationKeys.forEach((defaultAnnotationKey, index) => {
    const fieldIndex = orderedAnnotations.findIndex((field) => field.key === defaultAnnotationKey);

    if (fieldIndex === -1) {
      //add the default annotation if abstent
      const emptyValue = { key: defaultAnnotationKey, value: '' };
      orderedAnnotations.splice(index, 0, emptyValue);
    } else if (fieldIndex !== index) {
      //move it to the correct position if present
      orderedAnnotations.splice(index, 0, orderedAnnotations.splice(fieldIndex, 1)[0]);
    }
  });
  return orderedAnnotations;
}

export function getNotificationSettingsForDTO(
  manualRouting: boolean,
  contactPoints?: AlertManagerManualRouting
): GrafanaNotificationSettings | undefined {
  if (contactPoints?.grafana?.selectedContactPoint && manualRouting) {
    return {
      receiver: contactPoints?.grafana?.selectedContactPoint,
      mute_time_intervals: contactPoints?.grafana?.muteTimeIntervals,
      group_by: contactPoints?.grafana?.overrideGrouping ? contactPoints?.grafana?.groupBy : undefined,
      group_wait:
        contactPoints?.grafana?.overrideTimings && contactPoints?.grafana?.groupWaitValue
          ? contactPoints?.grafana?.groupWaitValue
          : undefined,
      group_interval:
        contactPoints?.grafana?.overrideTimings && contactPoints?.grafana?.groupIntervalValue
          ? contactPoints?.grafana?.groupIntervalValue
          : undefined,
      repeat_interval:
        contactPoints?.grafana?.overrideTimings && contactPoints?.grafana?.repeatIntervalValue
          ? contactPoints?.grafana?.repeatIntervalValue
          : undefined,
    };
  }
  return undefined;
}

export function formValuesToRulerGrafanaRuleDTO(values: RuleFormValues): PostableRuleGrafanaRuleDTO {
  const { name, condition, noDataState, execErrState, evaluateFor, queries, isPaused, contactPoints, manualRouting } =
    values;
  if (condition) {
    const notificationSettings: GrafanaNotificationSettings | undefined = getNotificationSettingsForDTO(
      manualRouting,
      contactPoints
    );

    return {
      grafana_alert: {
        title: name,
        condition,
        no_data_state: noDataState,
        exec_err_state: execErrState,
        data: queries.map(fixBothInstantAndRangeQuery),
        is_paused: Boolean(isPaused),
        notification_settings: notificationSettings,
      },
      for: evaluateFor,
      annotations: arrayToRecord(values.annotations || []),
      labels: arrayToRecord(values.labels || []),
    };
  }
  throw new Error('Cannot create rule without specifying alert condition');
}

export function getContactPointsFromDTO(ga: GrafanaRuleDefinition): AlertManagerManualRouting | undefined {
  const contactPoint: ContactPoint | undefined = ga.notification_settings
    ? {
        selectedContactPoint: ga.notification_settings.receiver,
        muteTimeIntervals: ga.notification_settings.mute_time_intervals ?? [],
        overrideGrouping:
          Array.isArray(ga.notification_settings.group_by) && ga.notification_settings.group_by.length > 0,
        overrideTimings: [
          ga.notification_settings.group_wait,
          ga.notification_settings.group_interval,
          ga.notification_settings.repeat_interval,
        ].some(Boolean),
        groupBy: ga.notification_settings.group_by || [],
        groupWaitValue: ga.notification_settings.group_wait || '',
        groupIntervalValue: ga.notification_settings.group_interval || '',
        repeatIntervalValue: ga.notification_settings.repeat_interval || '',
      }
    : undefined;
  const routingSettings: AlertManagerManualRouting | undefined = contactPoint
    ? {
        [GRAFANA_RULES_SOURCE_NAME]: contactPoint,
      }
    : undefined;
  return routingSettings;
}

export function rulerRuleToFormValues(ruleWithLocation: RuleWithLocation): RuleFormValues {
  const { ruleSourceName, namespace, group, rule } = ruleWithLocation;

  const defaultFormValues = getDefaultFormValues();
  if (isGrafanaRulesSource(ruleSourceName)) {
    if (isGrafanaRulerRule(rule)) {
      const ga = rule.grafana_alert;

      const routingSettings: AlertManagerManualRouting | undefined = getContactPointsFromDTO(ga);

      return {
        ...defaultFormValues,
        name: ga.title,
        type: RuleFormType.grafana,
        group: group.name,
        evaluateEvery: group.interval || defaultFormValues.evaluateEvery,
        evaluateFor: rule.for || '0',
        noDataState: ga.no_data_state,
        execErrState: ga.exec_err_state,
        queries: ga.data,
        condition: ga.condition,
        annotations: normalizeDefaultAnnotations(listifyLabelsOrAnnotations(rule.annotations, false)),
        labels: listifyLabelsOrAnnotations(rule.labels, true),
        folder: { title: namespace, uid: ga.namespace_uid },
        isPaused: ga.is_paused,

        contactPoints: routingSettings,
        manualRouting: Boolean(routingSettings),
      };
    } else {
      throw new Error('Unexpected type of rule for grafana rules source');
    }
  } else {
    if (isAlertingRulerRule(rule)) {
      const datasourceUid = getDataSourceSrv().getInstanceSettings(ruleSourceName)?.uid ?? '';

      const defaultQuery = {
        refId: 'A',
        datasourceUid,
        queryType: '',
        relativeTimeRange: getDefaultRelativeTimeRange(),
        expr: rule.expr,
        model: {
          refId: 'A',
          hide: false,
          expr: rule.expr,
        },
      };

      const alertingRuleValues = alertingRulerRuleToRuleForm(rule);

      return {
        ...defaultFormValues,
        ...alertingRuleValues,
        queries: [defaultQuery],
        annotations: normalizeDefaultAnnotations(listifyLabelsOrAnnotations(rule.annotations, false)),
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
): Pick<
  RuleFormValues,
  | 'name'
  | 'forTime'
  | 'forTimeUnit'
  | 'keepFiringForTime'
  | 'keepFiringForTimeUnit'
  | 'expression'
  | 'annotations'
  | 'labels'
> {
  const defaultFormValues = getDefaultFormValues();

  const [forTime, forTimeUnit] = rule.for ? parseInterval(rule.for) : [0, 's'];

  const [keepFiringForTime, keepFiringForTimeUnit] = rule.keep_firing_for
    ? parseInterval(rule.keep_firing_for)
    : [defaultFormValues.keepFiringForTime, defaultFormValues.keepFiringForTimeUnit];

  return {
    name: rule.alert,
    expression: rule.expr,
    forTime,
    forTimeUnit,
    keepFiringForTime,
    keepFiringForTimeUnit,
    annotations: listifyLabelsOrAnnotations(rule.annotations, false),
    labels: listifyLabelsOrAnnotations(rule.labels, true),
  };
}

export function recordingRulerRuleToRuleForm(
  rule: RulerRecordingRuleDTO
): Pick<RuleFormValues, 'name' | 'expression' | 'labels'> {
  return {
    name: rule.record,
    expression: rule.expr,
    labels: listifyLabelsOrAnnotations(rule.labels, true),
  };
}

export const getDefaultQueries = (): AlertQuery[] => {
  const dataSource = getDefaultOrFirstCompatibleDataSource();

  if (!dataSource) {
    return [...getDefaultExpressions('A', 'B')];
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
      },
    },
    ...getDefaultExpressions('B', 'C'),
  ];
};

export const getDefaultRecordingRulesQueries = (
  rulesSourcesWithRuler: Array<DataSourceInstanceSettings<DataSourceJsonData>>
): AlertQuery[] => {
  const relativeTimeRange = getDefaultRelativeTimeRange();

  return [
    {
      refId: 'A',
      datasourceUid: rulesSourcesWithRuler[0]?.uid || '',
      queryType: '',
      relativeTimeRange,
      model: {
        refId: 'A',
      },
    },
  ];
};

const getDefaultExpressions = (...refIds: [string, string]): AlertQuery[] => {
  const refOne = refIds[0];
  const refTwo = refIds[1];

  const reduceExpression: ExpressionQuery = {
    refId: refIds[0],
    type: ExpressionQueryType.reduce,
    datasource: {
      uid: ExpressionDatasourceUID,
      type: ExpressionDatasourceRef.type,
    },
    conditions: [
      {
        type: 'query',
        evaluator: {
          params: [],
          type: EvalFunction.IsAbove,
        },
        operator: {
          type: 'and',
        },
        query: {
          params: [refOne],
        },
        reducer: {
          params: [],
          type: 'last',
        },
      },
    ],
    reducer: 'last',
    expression: 'A',
  };

  const thresholdExpression: ExpressionQuery = {
    refId: refTwo,
    type: ExpressionQueryType.threshold,
    datasource: {
      uid: ExpressionDatasourceUID,
      type: ExpressionDatasourceRef.type,
    },
    conditions: [
      {
        type: 'query',
        evaluator: {
          params: [0],
          type: EvalFunction.IsAbove,
        },
        operator: {
          type: 'and',
        },
        query: {
          params: [refTwo],
        },
        reducer: {
          params: [],
          type: 'last',
        },
      },
    ],
    expression: refOne,
  };

  return [
    {
      refId: refOne,
      datasourceUid: ExpressionDatasourceUID,
      queryType: '',
      model: reduceExpression,
    },
    {
      refId: refTwo,
      datasourceUid: ExpressionDatasourceUID,
      queryType: '',
      model: thresholdExpression,
    },
  ];
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
      ? datasource.interpolateVariablesInQueries([target], queryVariables)[0]
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
    const [reduceExpression, _thresholdExpression] = getDefaultExpressions(getNextRefIdChar(queries), '-');
    queries.push(reduceExpression);

    const [_reduceExpression, thresholdExpression] = getDefaultExpressions(
      reduceExpression.refId,
      getNextRefIdChar(queries)
    );
    queries.push(thresholdExpression);
  }

  const { folderTitle, folderUid } = dashboard.meta;

  const formValues = {
    type: RuleFormType.grafana,
    folder:
      folderUid && folderTitle
        ? {
            uid: folderUid,
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

export const scenesPanelToRuleFormValues = async (vizPanel: VizPanel): Promise<Partial<RuleFormValues> | undefined> => {
  if (!vizPanel.state.key) {
    return undefined;
  }

  const timeRange = sceneGraph.getTimeRange(vizPanel);
  const queryRunner = getQueryRunnerFor(vizPanel);
  if (!queryRunner) {
    return undefined;
  }
  const { queries, datasource, maxDataPoints, minInterval } = queryRunner.state;

  const dashboard = getDashboardSceneFor(vizPanel);
  if (!dashboard || !dashboard.state.uid) {
    return undefined;
  }

  const grafanaQueries = await dataQueriesToGrafanaQueries(
    queries,
    rangeUtil.timeRangeToRelative(rangeUtil.convertRawToRange(timeRange.state.value.raw)),
    { __sceneObject: { value: vizPanel } },
    datasource,
    maxDataPoints,
    minInterval
  );

  // if no alerting capable queries are found, can't create a rule
  if (!grafanaQueries.length || !grafanaQueries.find((query) => query.datasourceUid !== ExpressionDatasourceUID)) {
    return undefined;
  }

  if (!grafanaQueries.find((query) => query.datasourceUid === ExpressionDatasourceUID)) {
    const [reduceExpression, _thresholdExpression] = getDefaultExpressions(getNextRefIdChar(grafanaQueries), '-');
    grafanaQueries.push(reduceExpression);

    const [_reduceExpression, thresholdExpression] = getDefaultExpressions(
      reduceExpression.refId,
      getNextRefIdChar(grafanaQueries)
    );
    grafanaQueries.push(thresholdExpression);
  }

  const { folderTitle, folderUid } = dashboard.state.meta;

  const formValues = {
    type: RuleFormType.grafana,
    folder:
      folderUid && folderTitle
        ? {
            uid: folderUid,
            title: folderTitle,
          }
        : undefined,
    queries: grafanaQueries,
    name: vizPanel.state.title,
    condition: grafanaQueries[grafanaQueries.length - 1].refId,
    annotations: [
      {
        key: Annotation.dashboardUID,
        value: dashboard.state.uid,
      },
      {
        key: Annotation.panelID,

        value: String(getPanelIdForVizPanel(vizPanel)),
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

export function fixBothInstantAndRangeQuery(query: AlertQuery) {
  const model = query.model;

  if (!isPromQuery(model)) {
    return query;
  }

  const isBothInstantAndRange = model.instant && model.range;
  if (isBothInstantAndRange) {
    return { ...query, model: { ...model, range: true, instant: false } };
  }

  return query;
}

function isPromQuery(model: AlertDataQuery): model is PromQuery {
  return 'expr' in model && 'instant' in model && 'range' in model;
}

export function isPromOrLokiQuery(model: AlertDataQuery): model is PromOrLokiQuery {
  return 'expr' in model;
}

// the backend will always execute "hidden" queries, so we have no choice but to remove the property in the front-end
// to avoid confusion. The query editor shows them as "disabled" and that's a different semantic meaning.
// furthermore the "AlertingQueryRunner" calls `filterQuery` on each data source and those will skip running queries that are "hidden"."
// It seems like we have no choice but to act like "hidden" queries don't exist in alerting.
export const ignoreHiddenQueries = (ruleDefinition: RuleFormValues): RuleFormValues => {
  return {
    ...ruleDefinition,
    queries: ruleDefinition.queries?.map((query) => omit(query, 'model.hide')),
  };
};

export function formValuesFromExistingRule(rule: RuleWithLocation<RulerRuleDTO>) {
  return ignoreHiddenQueries(rulerRuleToFormValues(rule));
}
