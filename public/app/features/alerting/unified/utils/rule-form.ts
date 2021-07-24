import { DataQuery, rangeUtil, RelativeTimeRange } from '@grafana/data';
import { getDataSourceSrv } from '@grafana/runtime';
import { contextSrv } from 'app/core/services/context_srv';
import { getNextRefIdChar } from 'app/core/utils/query';
import { DashboardModel, PanelModel } from 'app/features/dashboard/state';
import { ExpressionDatasourceID, ExpressionDatasourceUID } from 'app/features/expressions/ExpressionDatasource';
import { ExpressionQuery, ExpressionQueryType } from 'app/features/expressions/types';
import { getDatasourceSrv } from 'app/features/plugins/datasource_srv';
import { RuleWithLocation } from 'app/types/unified-alerting';
import {
  Annotations,
  GrafanaAlertStateDecision,
  AlertQuery,
  Labels,
  PostableRuleGrafanaRuleDTO,
  RulerAlertingRuleDTO,
} from 'app/types/unified-alerting-dto';
import { EvalFunction } from '../../state/alertDef';
import { RuleFormType, RuleFormValues } from '../types/rule-form';
import { Annotation } from './constants';
import { isGrafanaRulesSource } from './datasource';
import { arrayToRecord, recordToArray } from './misc';
import { isAlertingRulerRule, isGrafanaRulerRule } from './rules';
import { parseInterval } from './time';
import { getDefaultRelativeTimeRange } from '../../../../../../packages/grafana-data';

export const getDefaultFormValues = (): RuleFormValues =>
  Object.freeze({
    name: '',
    labels: [{ key: '', value: '' }],
    annotations: [
      { key: Annotation.summary, value: '' },
      { key: Annotation.description, value: '' },
      { key: Annotation.runbookURL, value: '' },
    ],
    dataSourceName: null,
    type: !contextSrv.isEditor ? RuleFormType.grafana : undefined, // viewers can't create prom alerts

    // grafana
    folder: null,
    queries: [],
    condition: '',
    noDataState: GrafanaAlertStateDecision.NoData,
    execErrState: GrafanaAlertStateDecision.Alerting,
    evaluateEvery: '1m',
    evaluateFor: '5m',

    // cortex / loki
    group: '',
    namespace: '',
    expression: '',
    forTime: 1,
    forTimeUnit: 'm',
  });

export function formValuesToRulerAlertingRuleDTO(values: RuleFormValues): RulerAlertingRuleDTO {
  const { name, expression, forTime, forTimeUnit } = values;
  return {
    alert: name,
    for: `${forTime}${forTimeUnit}`,
    annotations: arrayToRecord(values.annotations || []),
    labels: arrayToRecord(values.labels || []),
    expr: expression,
  };
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
      const [forTime, forTimeUnit] = rule.for
        ? parseInterval(rule.for)
        : [defaultFormValues.forTime, defaultFormValues.forTimeUnit];
      return {
        ...defaultFormValues,
        name: rule.alert,
        type: RuleFormType.cloud,
        dataSourceName: ruleSourceName,
        namespace,
        group: group.name,
        expression: rule.expr,
        forTime,
        forTimeUnit,
        annotations: listifyLabelsOrAnnotations(rule.annotations),
        labels: listifyLabelsOrAnnotations(rule.labels),
      };
    } else {
      throw new Error('Editing recording rules not supported (yet)');
    }
  }
}

export const getDefaultQueries = (): AlertQuery[] => {
  const dataSource = getDataSourceSrv().getInstanceSettings('default');

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
    datasource: ExpressionDatasourceID,
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
  };

  return {
    refId,
    datasourceUid: ExpressionDatasourceUID,
    queryType: '',
    model,
  };
};

const dataQueriesToGrafanaQueries = (
  queries: DataQuery[],
  relativeTimeRange: RelativeTimeRange,
  datasourceName?: string
): AlertQuery[] => {
  return queries.reduce<AlertQuery[]>((queries, target) => {
    const dsName = target.datasource || datasourceName;
    if (dsName) {
      // expressions
      if (dsName === ExpressionDatasourceID) {
        const newQuery: AlertQuery = {
          refId: target.refId,
          queryType: '',
          relativeTimeRange,
          datasourceUid: ExpressionDatasourceUID,
          model: target,
        };
        return [...queries, newQuery];
        // queries
      } else {
        const datasource = getDataSourceSrv().getInstanceSettings(target.datasource || datasourceName);
        if (datasource && datasource.meta.alerting) {
          const newQuery: AlertQuery = {
            refId: target.refId,
            queryType: target.queryType ?? '',
            relativeTimeRange,
            datasourceUid: datasource.uid,
            model: target,
          };
          return [...queries, newQuery];
        }
      }
    }
    return queries;
  }, []);
};

export const panelToRuleFormValues = (
  panel: PanelModel,
  dashboard: DashboardModel
): Partial<RuleFormValues> | undefined => {
  const { targets } = panel;

  // it seems if default datasource is selected, datasource=null, hah
  const datasourceName =
    panel.datasource === null ? getDatasourceSrv().getInstanceSettings('default')?.name : panel.datasource;

  if (!panel.editSourceId || !dashboard.uid) {
    return undefined;
  }

  const relativeTimeRange = rangeUtil.timeRangeToRelative(rangeUtil.convertRawToRange(dashboard.time));
  const queries = dataQueriesToGrafanaQueries(targets, relativeTimeRange, datasourceName);

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
    annotations: [
      {
        key: Annotation.dashboardUID,
        value: dashboard.uid,
      },
      {
        key: Annotation.panelID,
        value: String(panel.editSourceId),
      },
    ],
  };
  return formValues;
};
