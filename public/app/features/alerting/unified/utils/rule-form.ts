import {
  DataQuery,
  DataSourceInstanceSettings,
  DataSourceRef,
  IntervalValues,
  RelativeTimeRange,
  ScopedVars,
  TimeRange,
  getDefaultRelativeTimeRange,
  getNextRefId,
  rangeUtil,
} from '@grafana/data';
import { PromQuery } from '@grafana/prometheus';
import { config, getDataSourceSrv } from '@grafana/runtime';
import { ExpressionDatasourceRef } from '@grafana/runtime/src/utils/DataSourceWithBackend';
import { VizPanel, sceneGraph } from '@grafana/scenes';
import { DataSourceJsonData } from '@grafana/schema';
import { DashboardModel } from 'app/features/dashboard/state/DashboardModel';
import { PanelModel } from 'app/features/dashboard/state/PanelModel';
import {
  getDashboardSceneFor,
  getPanelIdForVizPanel,
  getQueryRunnerFor,
} from 'app/features/dashboard-scene/utils/utils';
import { ExpressionDatasourceUID, ExpressionQuery, ExpressionQueryType } from 'app/features/expressions/types';
import { LokiQuery } from 'app/plugins/datasource/loki/types';
import { RuleWithLocation } from 'app/types/unified-alerting';
import {
  AlertDataQuery,
  AlertQuery,
  Annotations,
  GrafanaNotificationSettings,
  GrafanaRuleDefinition,
  Labels,
  PostableRuleGrafanaRuleDTO,
  RulerAlertingRuleDTO,
  RulerRecordingRuleDTO,
  RulerRuleDTO,
} from 'app/types/unified-alerting-dto';

import { EvalFunction } from '../../state/alertDef';
import { getDefaultFormValues } from '../rule-editor/formDefaults';
import { normalizeDefaultAnnotations } from '../rule-editor/formProcessing';
import {
  AlertManagerManualRouting,
  ContactPoint,
  KVObject,
  RuleFormType,
  RuleFormValues,
  SimplifiedEditor,
} from '../types/rule-form';

import { Annotation } from './constants';
import {
  DataSourceType,
  GRAFANA_RULES_SOURCE_NAME,
  getDefaultOrFirstCompatibleDataSource,
  isGrafanaRulesSource,
} from './datasource';
import { arrayToRecord, recordToArray } from './misc';
import {
  isAlertingRulerRule,
  isGrafanaAlertingRuleByType,
  isGrafanaRecordingRule,
  isGrafanaRecordingRuleByType,
  isGrafanaRulerRule,
  isRecordingRulerRule,
} from './rules';
import { parseInterval } from './time';

export type PromOrLokiQuery = PromQuery | LokiQuery;

export const MANUAL_ROUTING_KEY = 'grafana.alerting.manualRouting';
export const SIMPLIFIED_QUERY_EDITOR_KEY = 'grafana.alerting.simplifiedQueryEditor';

export function formValuesToRulerRuleDTO(values: RuleFormValues): RulerRuleDTO {
  const { name, expression, forTime, forTimeUnit, keepFiringForTime, keepFiringForTimeUnit, type } = values;

  const annotations = arrayToRecord(cleanAnnotations(values.annotations));
  const labels = arrayToRecord(cleanLabels(values.labels));

  if (type === RuleFormType.cloudAlerting) {
    let keepFiringFor: string | undefined;
    if (keepFiringForTime && keepFiringForTimeUnit) {
      keepFiringFor = `${keepFiringForTime}${keepFiringForTimeUnit}`;
    }

    return {
      alert: name,
      for: `${forTime}${forTimeUnit}`,
      keep_firing_for: keepFiringFor,
      annotations,
      labels,
      expr: expression,
    };
  } else if (type === RuleFormType.cloudRecording) {
    return {
      record: name,
      labels,
      expr: expression,
    };
  }
  throw new Error(`unexpected rule type: ${type}`);
}

export function listifyLabelsOrAnnotations(item: Labels | Annotations | undefined, addEmpty: boolean): KVObject[] {
  const list = [...recordToArray(item || {})];
  if (addEmpty) {
    list.push({ key: '', value: '' });
  }
  return list;
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
function getEditorSettingsForDTO(simplifiedEditor: SimplifiedEditor) {
  return {
    simplified_query_and_expressions_section: simplifiedEditor.simplifiedQueryEditor,
    simplified_notifications_section: simplifiedEditor.simplifiedNotificationEditor,
  };
}
export function formValuesToRulerGrafanaRuleDTO(values: RuleFormValues): PostableRuleGrafanaRuleDTO {
  const {
    name,
    condition,
    noDataState,
    execErrState,
    evaluateFor,
    queries,
    isPaused,
    contactPoints,
    manualRouting,
    type,
    metric,
  } = values;
  if (!condition) {
    throw new Error('You cannot create an alert rule without specifying the alert condition');
  }

  const notificationSettings = getNotificationSettingsForDTO(manualRouting, contactPoints);
  const metadata = values.editorSettings
    ? { editor_settings: getEditorSettingsForDTO(values.editorSettings) }
    : undefined;

  const annotations = arrayToRecord(cleanAnnotations(values.annotations));
  const labels = arrayToRecord(cleanLabels(values.labels));

  const wantsAlertingRule = isGrafanaAlertingRuleByType(type);
  const wantsRecordingRule = isGrafanaRecordingRuleByType(type!);

  if (wantsAlertingRule) {
    return {
      grafana_alert: {
        title: name,
        condition,
        data: queries.map(fixBothInstantAndRangeQuery),
        is_paused: Boolean(isPaused),

        // Alerting rule specific
        no_data_state: noDataState,
        exec_err_state: execErrState,
        notification_settings: notificationSettings,
        metadata,
      },
      annotations,
      labels,

      // Alerting rule specific
      for: evaluateFor,
    };
  } else if (wantsRecordingRule) {
    return {
      grafana_alert: {
        title: name,
        condition,
        data: queries.map(fixBothInstantAndRangeQuery),
        is_paused: Boolean(isPaused),

        // Recording rule specific
        record: {
          metric: metric ?? name,
          from: condition,
        },
      },
      annotations,
      labels,
    };
  }

  throw new Error(`Failed to convert form values to Grafana rule: unknown type ${type}`);
}

export const cleanAnnotations = (kvs: KVObject[]) =>
  kvs.map(trimKeyAndValue).filter(({ key, value }: KVObject): Boolean => Boolean(key) && Boolean(value));

export const cleanLabels = (kvs: KVObject[]) =>
  kvs.map(trimKeyAndValue).filter(({ key }: KVObject): Boolean => Boolean(key));

const trimKeyAndValue = ({ key, value }: KVObject): KVObject => ({
  key: key.trim(),
  value: value.trim(),
});

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

function getEditorSettingsFromDTO(ga: GrafanaRuleDefinition) {
  // we need to check if the feature toggle is enabled as it might be disabled after the rule was created with the feature enabled
  if (!config.featureToggles.alertingQueryAndExpressionsStepMode) {
    return undefined;
  }

  if (ga.metadata?.editor_settings) {
    return {
      simplifiedQueryEditor: ga.metadata.editor_settings.simplified_query_and_expressions_section,
      simplifiedNotificationEditor: ga.metadata.editor_settings.simplified_notifications_section,
    };
  }

  return {
    simplifiedQueryEditor: false,
    simplifiedNotificationEditor: Boolean(ga.notification_settings), // in case this rule was created before the new field was added, we'll default to current routing settings
  };
}

export function rulerRuleToFormValues(ruleWithLocation: RuleWithLocation): RuleFormValues {
  const { ruleSourceName, namespace, group, rule } = ruleWithLocation;

  const defaultFormValues = getDefaultFormValues();
  if (isGrafanaRulesSource(ruleSourceName)) {
    // GRAFANA-MANAGED RULES
    if (isGrafanaRecordingRule(rule)) {
      // grafana recording rule
      const ga = rule.grafana_alert;
      return {
        ...defaultFormValues,
        name: ga.title,
        type: RuleFormType.grafanaRecording,
        group: group.name,
        evaluateEvery: group.interval || defaultFormValues.evaluateEvery,
        queries: ga.data,
        condition: ga.condition,
        annotations: normalizeDefaultAnnotations(listifyLabelsOrAnnotations(rule.annotations, false)),
        labels: listifyLabelsOrAnnotations(rule.labels, true),
        folder: { title: namespace, uid: ga.namespace_uid },
        isPaused: ga.is_paused,
        metric: ga.record?.metric,
      };
    } else if (isGrafanaRulerRule(rule)) {
      // grafana alerting rule
      const ga = rule.grafana_alert;
      const routingSettings: AlertManagerManualRouting | undefined = getContactPointsFromDTO(ga);
      if (ga.no_data_state !== undefined && ga.exec_err_state !== undefined) {
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

          editorSettings: getEditorSettingsFromDTO(ga),
        };
      } else {
        throw new Error('Unexpected type of rule for grafana rules source');
      }
    } else {
      throw new Error('Unexpected type of rule for grafana rules source');
    }
  } else {
    // DATASOURCE-MANAGED RULES
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

export const getDefaultQueries = (isRecordingRule = false): AlertQuery[] => {
  const dataSource = getDefaultOrFirstCompatibleDataSource();
  if (!dataSource) {
    const expressions = isRecordingRule ? getDefaultExpressionsForRecording('A') : getDefaultExpressions('A', 'B');
    return [...expressions];
  }
  const relativeTimeRange = getDefaultRelativeTimeRange();

  const expressions = isRecordingRule ? getDefaultExpressionsForRecording('B') : getDefaultExpressions('B', 'C');
  const isLokiOrPrometheus = dataSource?.type === DataSourceType.Prometheus || dataSource?.type === DataSourceType.Loki;
  return [
    {
      refId: 'A',
      datasourceUid: dataSource.uid,
      queryType: '',
      relativeTimeRange,
      model: {
        refId: 'A',
        instant: isLokiOrPrometheus ? true : undefined,
      },
    },
    ...expressions,
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
const getDefaultExpressionsForRecording = (refOne: string): AlertQuery[] => {
  const reduceExpression: ExpressionQuery = {
    refId: refOne,
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

  return [
    {
      refId: refOne,
      datasourceUid: ExpressionDatasourceUID,
      queryType: '',
      model: reduceExpression,
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
    const [reduceExpression, _thresholdExpression] = getDefaultExpressions(getNextRefId(queries), '-');
    queries.push(reduceExpression);

    const [_reduceExpression, thresholdExpression] = getDefaultExpressions(
      reduceExpression.refId,
      getNextRefId(queries)
    );
    queries.push(thresholdExpression);
  }

  const { folderTitle, folderUid } = dashboard.meta;
  const folder =
    folderUid && folderTitle
      ? {
          kind: 'folder',
          uid: folderUid,
          title: folderTitle,
        }
      : undefined;

  const formValues = {
    type: RuleFormType.grafana,
    folder,
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
    const [reduceExpression, _thresholdExpression] = getDefaultExpressions(getNextRefId(grafanaQueries), '-');
    grafanaQueries.push(reduceExpression);

    const [_reduceExpression, thresholdExpression] = getDefaultExpressions(
      reduceExpression.refId,
      getNextRefId(grafanaQueries)
    );
    grafanaQueries.push(thresholdExpression);
  }

  const { folderTitle, folderUid } = dashboard.state.meta;

  const folder =
    folderUid && folderTitle
      ? {
          kind: 'folder',
          uid: folderUid,
          title: folderTitle,
        }
      : undefined;

  const formValues = {
    type: RuleFormType.grafana,
    folder,
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

export function getInstantFromDataQuery(model: AlertDataQuery, type: string): boolean | undefined {
  // if the datasource is not prometheus or loki, instant is defined in the model or defaults to undefined
  if (type !== DataSourceType.Prometheus && type !== DataSourceType.Loki) {
    if ('instant' in model) {
      return model.instant;
    } else {
      if ('queryType' in model) {
        return model.queryType === 'instant';
      } else {
        return undefined;
      }
    }
  }
  // if the datasource is prometheus or loki, instant is defined in the model, or defaults to true
  const isInstantForPrometheus = 'instant' in model && model.instant !== undefined ? model.instant : true;
  const isInstantForLoki = 'queryType' in model && model.queryType !== undefined ? model.queryType === 'instant' : true;

  const isInstant = type === DataSourceType.Prometheus ? isInstantForPrometheus : isInstantForLoki;
  return isInstant;
}
