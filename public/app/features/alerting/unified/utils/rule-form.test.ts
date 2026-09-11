import { type PromQuery } from '@grafana/prometheus';
import { config } from '@grafana/runtime';
import type { ExpressionQuery } from 'app/features/expressions/schemas/expressionQuery';
import { ExpressionDatasourceUID, ExpressionQueryType } from 'app/features/expressions/types';
import { type RuleWithLocation } from 'app/types/unified-alerting';
import {
  type AlertDataQuery,
  type AlertQuery,
  GrafanaAlertStateDecision,
  type GrafanaRuleDefinition,
  type RulerAlertingRuleDTO,
  type RulerGrafanaRuleDTO,
} from 'app/types/unified-alerting-dto';

import { EvalFunction } from '../../state/alertDef';
import { mockDataSource, mockRuleWithLocation, mockRulerGrafanaRecordingRule, mockRulerGrafanaRule } from '../mocks';
import { getDefaultFormValues } from '../rule-editor/formDefaults';
import { setupDataSources } from '../testSetup/datasources';
import { type AlertManagerManualRouting, RuleFormType, type RuleFormValues } from '../types/rule-form';

import { DataSourceType, GRAFANA_RULES_SOURCE_NAME } from './datasource';
import {
  alertingRulerRuleToRuleForm,
  cleanAnnotations,
  cleanLabels,
  fixMissingRefIdsInExpressionModel,
  folderFromDashboardMeta,
  formValuesToRulerGrafanaRuleDTO,
  formValuesToRulerRuleDTO,
  getContactPointsFromDTO,
  getDefaultExpressions,
  getInstantFromDataQuery,
  getNotificationSettingsForDTO,
  grafanaRuleDtoToFormValues,
  rulerRuleToFormValues,
} from './rule-form';

describe('folderFromDashboardMeta', () => {
  it('returns undefined when no folder metadata', () => {
    expect(folderFromDashboardMeta({})).toBeUndefined();
    expect(folderFromDashboardMeta({ folderUid: '', folderTitle: '' })).toBeUndefined();
  });

  it('returns folder uid and title for nested dashboards', () => {
    expect(folderFromDashboardMeta({ folderUid: 'f1', folderTitle: 'Infra' })).toEqual({
      uid: 'f1',
      title: 'Infra',
    });
  });

  it('returns root folder when only title is set (e.g. Dashboards)', () => {
    expect(folderFromDashboardMeta({ folderUid: '', folderTitle: 'Dashboards' })).toEqual({
      uid: '',
      title: 'Dashboards',
    });
  });

  it('uses uid as display title when title is missing but uid is set', () => {
    expect(folderFromDashboardMeta({ folderUid: 'abc', folderTitle: '' })).toEqual({
      uid: 'abc',
      title: 'abc',
    });
  });
});

describe('formValuesToRulerGrafanaRuleDTO', () => {
  it('should correctly convert rule form values for grafana alerting rule', () => {
    const formValues: RuleFormValues = {
      ...getDefaultFormValues(),
      condition: 'A',
      type: RuleFormType.grafana,
    };

    expect(formValuesToRulerGrafanaRuleDTO(formValues)).toMatchSnapshot();
  });

  it('should correctly convert rule form values for grafana recording rule', () => {
    const formValues: RuleFormValues = {
      ...getDefaultFormValues(),
      condition: 'A',
      type: RuleFormType.grafanaRecording,
    };

    expect(formValuesToRulerGrafanaRuleDTO(formValues)).toMatchSnapshot();
  });

  it('sets notification_settings.receiver only when manualRouting is true', () => {
    const base: RuleFormValues = {
      ...getDefaultFormValues(),
      type: RuleFormType.grafana,
      condition: 'A',
      contactPoints: {
        grafana: {
          selectedContactPoint: 'team-receiver',
          muteTimeIntervals: [],
          activeTimeIntervals: [],
          overrideGrouping: false,
          overrideTimings: false,
          groupBy: [],
          groupWaitValue: '',
          groupIntervalValue: '',
          repeatIntervalValue: '',
        },
      },
    };

    // manualRouting false → no notification_settings
    const dtoNoManual = formValuesToRulerGrafanaRuleDTO({ ...base, manualRouting: false });
    expect(dtoNoManual.grafana_alert.notification_settings).toBeUndefined();

    // manualRouting true → notification_settings.receiver present
    const dtoManual = formValuesToRulerGrafanaRuleDTO({ ...base, manualRouting: true });
    expect(dtoManual.grafana_alert.notification_settings?.receiver).toBe('team-receiver');
  });

  it('should not save both instant and range type queries', () => {
    const defaultValues = getDefaultFormValues();

    const values: RuleFormValues = {
      ...defaultValues,
      type: RuleFormType.grafana,
      queries: [
        {
          refId: 'A',
          relativeTimeRange: { from: 900, to: 1000 },
          datasourceUid: 'dsuid',
          model: { refId: 'A', expr: '', instant: true, range: true } as PromQuery,
          queryType: 'query',
        },
      ],
      condition: 'A',
    };

    expect(formValuesToRulerGrafanaRuleDTO(values)).toMatchSnapshot();
  });

  it('should set keep_firing_for if values are populated', () => {
    const formValues: RuleFormValues = {
      ...getDefaultFormValues(),
      type: RuleFormType.cloudAlerting,
      condition: 'A',
      keepFiringForTime: 1,
      keepFiringForTimeUnit: 'm',
    };

    expect(formValuesToRulerRuleDTO(formValues)).toMatchSnapshot();
  });

  it('should not set keep_firing_for if values are undefined', () => {
    const formValues: RuleFormValues = {
      ...getDefaultFormValues(),
      type: RuleFormType.cloudAlerting,
      condition: 'A',
    };

    expect(formValuesToRulerRuleDTO(formValues)).toMatchSnapshot();
  });

  it('should parse keep_firing_for', () => {
    const rule: RulerAlertingRuleDTO = {
      alert: 'A',
      expr: 'B',
      for: '1m',
      keep_firing_for: '1m',
      labels: {},
    };

    expect(alertingRulerRuleToRuleForm(rule)).toMatchSnapshot();
  });

  it('should set keepFiringForTime and keepFiringForTimeUnit to undefined if keep_firing_for not set', () => {
    const rule: RulerAlertingRuleDTO = {
      alert: 'A',
      expr: 'B',
      for: '1m',
      labels: {},
    };

    expect(alertingRulerRuleToRuleForm(rule)).toMatchSnapshot();
  });
});

describe('rulerRuleToFormValues', () => {
  it('should convert grafana recording rule to form values', () => {
    const mockRecordingRule = mockRulerGrafanaRecordingRule({
      grafana_alert: {
        uid: 'recording-rule-uid',
        title: 'My Recording Rule',
        namespace_uid: 'folder-uid',
        rule_group: 'recording-group',
        condition: 'A',
        record: {
          metric: 'my_metric',
          from: 'A',
          target_datasource_uid: 'target-ds-uid',
        },
        data: [
          {
            datasourceUid: 'prom-uid',
            refId: 'A',
            queryType: '',
            model: { refId: 'A' },
          },
        ],
        is_paused: false,
      },
      annotations: {
        description: 'This is a recording rule',
        summary: 'Recording rule summary',
      },
      labels: {
        team: 'platform',
        env: 'production',
      },
    });

    const ruleWithLocation: RuleWithLocation = mockRuleWithLocation(mockRecordingRule, {
      ruleSourceName: GRAFANA_RULES_SOURCE_NAME,
      namespace: 'Test Folder',
      group: {
        name: 'recording-group',
        interval: '1m',
        rules: [mockRecordingRule],
      },
    });

    const result = rulerRuleToFormValues(ruleWithLocation);

    expect(result).toMatchObject({
      name: 'My Recording Rule',
      type: RuleFormType.grafanaRecording,
      group: 'recording-group',
      evaluateEvery: '1m',
      queries: [
        {
          datasourceUid: 'prom-uid',
          refId: 'A',
          queryType: '',
          model: { refId: 'A' },
        },
      ],
      condition: 'A',
      annotations: [
        { key: 'summary', value: 'Recording rule summary' },
        { key: 'description', value: 'This is a recording rule' },
        { key: 'runbook_url', value: '' },
      ],
      labels: [
        { key: 'team', value: 'platform' },
        { key: 'env', value: 'production' },
        { key: '', value: '' }, // empty row added for form editing
      ],
      folder: { title: 'Test Folder', uid: 'folder-uid' },
      isPaused: false,
      metric: 'my_metric',
      targetDatasourceUid: 'target-ds-uid',
    });
  });
});

describe('getContactPointsFromDTO', () => {
  it('should return undefined when notification_settings has only policy (no receiver)', () => {
    const ga: GrafanaRuleDefinition = {
      uid: '123',
      version: 1,
      title: 'myalert',
      namespace_uid: '123',
      rule_group: 'my-group',
      condition: 'A',
      no_data_state: GrafanaAlertStateDecision.Alerting,
      exec_err_state: GrafanaAlertStateDecision.Alerting,
      data: [],
      notification_settings: { policy: 'TestPolicy' },
    };
    const result = getContactPointsFromDTO(ga);
    expect(result).toBeUndefined();
  });

  it('should return undefined if notification_settings is not defined', () => {
    const ga: GrafanaRuleDefinition = {
      uid: '123',
      version: 1,
      title: 'myalert',
      namespace_uid: '123',
      rule_group: 'my-group',
      condition: 'A',
      no_data_state: GrafanaAlertStateDecision.Alerting,
      exec_err_state: GrafanaAlertStateDecision.Alerting,
      data: [
        {
          datasourceUid: '123',
          refId: 'A',
          queryType: 'huh',
          model: { refId: 'A' },
        },
      ],
      notification_settings: undefined,
    };

    const result = getContactPointsFromDTO(ga);
    expect(result).toBeUndefined();
  });

  it('should return routingSettings with correct props if notification_settings is defined', () => {
    const ga: GrafanaRuleDefinition = {
      uid: '123',
      version: 1,
      title: 'myalert',
      namespace_uid: '123',
      rule_group: 'my-group',
      condition: 'A',
      no_data_state: GrafanaAlertStateDecision.Alerting,
      exec_err_state: GrafanaAlertStateDecision.Alerting,
      data: [
        {
          datasourceUid: '123',
          refId: 'A',
          queryType: 'huh',
          model: { refId: 'A' },
        },
      ],
      notification_settings: {
        receiver: 'receiver',
        mute_time_intervals: ['mute_timing'],
        active_time_intervals: ['active_timing'],
        group_by: ['group_by'],
        group_wait: 'group_wait',
        group_interval: 'group_interval',
        repeat_interval: 'repeat_interval',
      },
    };

    const result = getContactPointsFromDTO(ga);
    expect(result).toEqual({
      [GRAFANA_RULES_SOURCE_NAME]: {
        selectedContactPoint: 'receiver',
        muteTimeIntervals: ['mute_timing'],
        activeTimeIntervals: ['active_timing'],
        overrideGrouping: true,
        overrideTimings: true,
        groupBy: ['group_by'],
        groupWaitValue: 'group_wait',
        groupIntervalValue: 'group_interval',
        repeatIntervalValue: 'repeat_interval',
      },
    });
  });
});

describe('getNotificationSettingsForDTO', () => {
  it('should return undefined if manualRouting is false', () => {
    const manualRouting = false;
    const contactPoints: AlertManagerManualRouting = {
      grafana: {
        selectedContactPoint: 'receiver',
        muteTimeIntervals: ['mute_timing'],
        activeTimeIntervals: ['active_timing'],
        overrideGrouping: true,
        overrideTimings: true,
        groupBy: ['group_by'],
        groupWaitValue: 'group_wait',
        groupIntervalValue: 'group_interval',
        repeatIntervalValue: 'repeat_interval',
      },
    };

    const result = getNotificationSettingsForDTO(manualRouting, contactPoints);
    expect(result).toBeUndefined();
  });

  it('should return undefined if selectedContactPoint is not defined', () => {
    const manualRouting = true;

    const result = getNotificationSettingsForDTO(manualRouting, undefined);
    expect(result).toBeUndefined();
  });

  it('should return notification settings if manualRouting is true and selectedContactPoint is defined', () => {
    const manualRouting = true;
    const contactPoints: AlertManagerManualRouting = {
      grafana: {
        selectedContactPoint: 'receiver',
        muteTimeIntervals: ['mute_timing'],
        activeTimeIntervals: ['active_timing'],
        overrideGrouping: true,
        overrideTimings: true,
        groupBy: ['group_by'],
        groupWaitValue: 'group_wait',
        groupIntervalValue: 'group_interval',
        repeatIntervalValue: 'repeat_interval',
      },
    };

    const result = getNotificationSettingsForDTO(manualRouting, contactPoints);
    expect(result).toEqual({
      receiver: 'receiver',
      mute_time_intervals: ['mute_timing'],
      active_time_intervals: ['active_timing'],
      group_by: ['group_by'],
      group_wait: 'group_wait',
      group_interval: 'group_interval',
      repeat_interval: 'repeat_interval',
    });
  });
});

describe('getNotificationSettingsForDTO with selectedPolicy', () => {
  it('should return policy DTO when alertingPolicyRoutingSettings is ON and selectedPolicy is set', () => {
    jest.replaceProperty(config, 'featureToggles', {
      ...config.featureToggles,
      alertingPolicyRoutingSettings: true,
    });
    const result = getNotificationSettingsForDTO(false, undefined, 'TestPolicy');
    expect(result).toEqual({ policy: 'TestPolicy' });
    jest.restoreAllMocks();
  });

  it('should return policy DTO even when alertingPolicyRoutingSettings is OFF', () => {
    jest.replaceProperty(config, 'featureToggles', {
      ...config.featureToggles,
      alertingPolicyRoutingSettings: false,
    });
    const result = getNotificationSettingsForDTO(false, undefined, 'TestPolicy');
    expect(result).toEqual({ policy: 'TestPolicy' });
    jest.restoreAllMocks();
  });

  it('should return undefined when selectedPolicy is not set (legacy label-only rule)', () => {
    jest.replaceProperty(config, 'featureToggles', {
      ...config.featureToggles,
      alertingPolicyRoutingSettings: false,
    });
    const result = getNotificationSettingsForDTO(false, undefined, undefined);
    expect(result).toBeUndefined();
    jest.restoreAllMocks();
  });

  it('should NOT return policy DTO when manualRouting is true even if selectedPolicy is set', () => {
    jest.replaceProperty(config, 'featureToggles', {
      ...config.featureToggles,
      alertingPolicyRoutingSettings: true,
    });
    const result = getNotificationSettingsForDTO(true, undefined, 'TestPolicy');
    expect(result).toBeUndefined();
    jest.restoreAllMocks();
  });
});

describe('rulerRuleToFormValues with policy routing', () => {
  it('should set selectedPolicy and manualRouting=false when notification_settings.policy is defined', () => {
    const rule: RulerGrafanaRuleDTO = {
      for: '1m',
      grafana_alert: {
        uid: 'abc',
        version: 1,
        title: 'Policy rule',
        namespace_uid: 'ns1',
        rule_group: 'group1',
        condition: 'A',
        no_data_state: GrafanaAlertStateDecision.Alerting,
        exec_err_state: GrafanaAlertStateDecision.Alerting,
        data: [],
        notification_settings: { policy: 'TestPolicy' },
      },
      annotations: {},
      labels: {},
    };
    const ruleWithLocation: RuleWithLocation = {
      ruleSourceName: GRAFANA_RULES_SOURCE_NAME,
      namespace: 'my-folder',
      group: { name: 'group1', interval: '1m', rules: [rule] },
      rule,
    };
    const result = rulerRuleToFormValues(ruleWithLocation);
    expect(result.selectedPolicy).toBe('TestPolicy');
    expect(result.manualRouting).toBe(false);
    expect(result.contactPoints).toBeUndefined();
  });
});

describe('rulerRuleToFormValues with legacy label migration', () => {
  const makeLegacyLabelRule = (policyName: string): RuleWithLocation => {
    const rule: RulerGrafanaRuleDTO = {
      for: '1m',
      grafana_alert: {
        uid: 'abc',
        version: 1,
        title: 'Legacy rule',
        namespace_uid: 'ns1',
        rule_group: 'group1',
        condition: 'A',
        no_data_state: GrafanaAlertStateDecision.Alerting,
        exec_err_state: GrafanaAlertStateDecision.Alerting,
        data: [],
      },
      annotations: {},
      labels: { __grafana_managed_route__: policyName },
    };
    return {
      ruleSourceName: GRAFANA_RULES_SOURCE_NAME,
      namespace: 'my-folder',
      group: { name: 'group1', interval: '1m', rules: [rule] },
      rule,
    };
  };

  it('should migrate legacy label to selectedPolicy when FF is ON', () => {
    jest.replaceProperty(config, 'featureToggles', {
      ...config.featureToggles,
      alertingPolicyRoutingSettings: true,
    });
    const result = rulerRuleToFormValues(makeLegacyLabelRule('TestPolicy'));
    expect(result.selectedPolicy).toBe('TestPolicy');
    expect(result.manualRouting).toBe(false);
    jest.restoreAllMocks();
  });

  it('should NOT migrate legacy label when FF is OFF', () => {
    jest.replaceProperty(config, 'featureToggles', {
      ...config.featureToggles,
      alertingPolicyRoutingSettings: false,
    });
    const result = rulerRuleToFormValues(makeLegacyLabelRule('TestPolicy'));
    expect(result.selectedPolicy).toBeUndefined();
    jest.restoreAllMocks();
  });
});

describe('formValuesToRulerGrafanaRuleDTO label stripping', () => {
  const baseValues = (): RuleFormValues => ({
    ...getDefaultFormValues(),
    condition: 'A',
    type: RuleFormType.grafana,
    labels: [
      { key: '__grafana_managed_route__', value: 'TestPolicy' },
      { key: 'env', value: 'prod' },
    ],
  });

  it('should strip __grafana_managed_route__ label from payload when FF is ON', () => {
    jest.replaceProperty(config, 'featureToggles', {
      ...config.featureToggles,
      alertingPolicyRoutingSettings: true,
    });
    const result = formValuesToRulerGrafanaRuleDTO(baseValues());
    expect(result.labels).not.toHaveProperty('__grafana_managed_route__');
    expect(result.labels).toHaveProperty('env', 'prod');
    jest.restoreAllMocks();
  });

  it('should write notification_settings.policy (and strip the legacy label) for a policy-field rule when FF is OFF', () => {
    jest.replaceProperty(config, 'featureToggles', {
      ...config.featureToggles,
      alertingPolicyRoutingSettings: false,
    });
    const values: RuleFormValues = {
      ...getDefaultFormValues(),
      condition: 'A',
      type: RuleFormType.grafana,
      manualRouting: false,
      selectedPolicy: 'TestPolicy',
      labels: [{ key: 'env', value: 'prod' }],
    };
    const result = formValuesToRulerGrafanaRuleDTO(values);
    expect(result.grafana_alert.notification_settings).toEqual({ policy: 'TestPolicy' });
    expect(result.labels).not.toHaveProperty('__grafana_managed_route__');
    expect(result.labels).toHaveProperty('env', 'prod');
    jest.restoreAllMocks();
  });

  it('should preserve __grafana_managed_route__ label in payload when FF is OFF', () => {
    jest.replaceProperty(config, 'featureToggles', {
      ...config.featureToggles,
      alertingPolicyRoutingSettings: false,
    });
    const result = formValuesToRulerGrafanaRuleDTO(baseValues());
    expect(result.labels).toHaveProperty('__grafana_managed_route__', 'TestPolicy');
    expect(result.labels).toHaveProperty('env', 'prod');
    jest.restoreAllMocks();
  });
});

describe('cleanAnnotations', () => {
  it('should remove falsy KVs', () => {
    const output = cleanAnnotations([{ key: '', value: '' }]);
    expect(output).toStrictEqual([]);
  });

  it('should trim keys and values', () => {
    const output = cleanAnnotations([{ key: ' spaces ', value: ' spaces too  ' }]);
    expect(output).toStrictEqual([{ key: 'spaces', value: 'spaces too' }]);
  });
});

describe('cleanLabels', () => {
  it('should remove falsy KVs', () => {
    const output = cleanLabels([{ key: '', value: '' }]);
    expect(output).toStrictEqual([]);
  });

  it('should trim keys and values', () => {
    const output = cleanLabels([{ key: ' spaces ', value: ' spaces too  ' }]);
    expect(output).toStrictEqual([{ key: 'spaces', value: 'spaces too' }]);
  });

  it('should leave empty values', () => {
    const output = cleanLabels([{ key: 'key', value: '' }]);
    expect(output).toStrictEqual([{ key: 'key', value: '' }]);
  });
});

describe('getInstantFromDataQuery', () => {
  const query: AlertQuery<AlertDataQuery> = {
    refId: 'Q',
    datasourceUid: 'abc123',
    queryType: '',
    relativeTimeRange: {
      from: 600,
      to: 0,
    },
    model: {
      refId: 'Q',
    },
  };

  it('should return undefined if datasource UID is undefined', () => {
    setupDataSources(mockDataSource({ type: DataSourceType.Prometheus, name: 'Mimir-cloud', uid: 'mimir-1' }));
    const result = getInstantFromDataQuery({ ...query });
    expect(result).toBeUndefined();
  });

  it('should return undefined if datasource type is not Prometheus or Loki', () => {
    setupDataSources(mockDataSource({ type: DataSourceType.Alertmanager, name: 'aa', uid: 'aa-1' }));
    const result = getInstantFromDataQuery({ ...query, datasourceUid: 'aa' });
    expect(result).toBeUndefined();
  });

  it('should return true if datasource is Prometheus and instant is not defined', () => {
    setupDataSources(mockDataSource({ type: DataSourceType.Prometheus, name: 'aa', uid: 'aa-1' }));
    const result = getInstantFromDataQuery({ ...query, datasourceUid: 'aa' });

    expect(result).toBe(true);
  });

  it('should return the value of instant if datasource is Prometheus and instant is defined', () => {
    setupDataSources(mockDataSource({ type: DataSourceType.Prometheus, name: 'aa', uid: 'aa-1' }));
    const result = getInstantFromDataQuery({ ...query, datasourceUid: 'aa', model: { refId: 'f', instant: false } });
    expect(result).toBe(false);
  });

  it('should return true if datasource is Loki and queryType is not defined', () => {
    setupDataSources(mockDataSource({ type: DataSourceType.Loki, name: 'aa', uid: 'aa-1' }));
    const result = getInstantFromDataQuery({ ...query, datasourceUid: 'aa' });
    expect(result).toBe(true);
  });

  it('should return true if datasource is Loki and queryType is instant', () => {
    setupDataSources(mockDataSource({ type: DataSourceType.Loki, name: 'aa', uid: 'aa-1' }));
    const result = getInstantFromDataQuery({
      ...query,
      datasourceUid: 'aa',
      model: { refId: 'f', queryType: 'instant' },
    });

    expect(result).toBe(true);
  });

  it('should return false if datasource is Loki and queryType is not instant', () => {
    setupDataSources(mockDataSource({ type: DataSourceType.Loki, name: 'aa', uid: 'aa-1' }));
    const result = getInstantFromDataQuery({
      ...query,
      datasourceUid: 'aa',
      model: { refId: 'f', queryType: 'range' },
    });

    expect(result).toBe(false);
  });
});

function isExpressionQuery(model: unknown): model is ExpressionQuery {
  return typeof model === 'object' && model !== null && 'type' in model;
}

describe('getDefaultExpressions', () => {
  it('should create a reduce expression as the first query', () => {
    const [reduceQuery] = getDefaultExpressions('B', 'C');

    expect(reduceQuery).toMatchObject({
      refId: 'B',
      datasourceUid: ExpressionDatasourceUID,
      queryType: 'expression',
      model: {
        type: ExpressionQueryType.reduce,
        refId: 'B',
        datasource: { uid: ExpressionDatasourceUID },
        reducer: 'last',
        expression: 'A',
      },
    });
  });

  it('should not give the reduce expression a conditions array', () => {
    const [reduceQuery] = getDefaultExpressions('B', 'C');

    // Older versions wrote a full classic condition in here. The backend never read it, and the
    // reduce editor never showed it.
    expect(Object.keys(reduceQuery.model)).not.toContain('conditions');
  });

  it('should create a threshold expression as the second query', () => {
    const [, thresholdQuery] = getDefaultExpressions('B', 'C');

    expect(thresholdQuery).toMatchObject({
      refId: 'C',
      datasourceUid: ExpressionDatasourceUID,
      queryType: 'expression',
      model: {
        type: ExpressionQueryType.threshold,
        refId: 'C',
        datasource: { uid: ExpressionDatasourceUID },
        expression: 'B',
      },
    });
  });

  it('should give the threshold expression exactly one condition, which is all the backend takes', () => {
    const [, thresholdQuery] = getDefaultExpressions('B', 'C');

    expect(thresholdQuery.model).toMatchObject({
      conditions: [{ evaluator: { params: [0], type: EvalFunction.IsAbove } }],
    });
  });

  it('should not give the threshold condition the classic-only fields', () => {
    const [, thresholdQuery] = getDefaultExpressions('B', 'C');
    const model = thresholdQuery.model;

    if (!isExpressionQuery(model) || model.type !== ExpressionQueryType.threshold) {
      throw new Error('Expected a threshold expression');
    }

    const [condition] = model.conditions;
    expect(Object.keys(condition)).not.toContain('query');
    expect(Object.keys(condition)).not.toContain('reducer');
    expect(Object.keys(condition)).not.toContain('operator');
  });

  it('should read the source query from the third refId when one is given', () => {
    const [reduceQuery] = getDefaultExpressions('B', 'C', 'Z');

    expect(reduceQuery.model).toMatchObject({ expression: 'Z' });
  });

  it('should properly use different refIds throughout the structure', () => {
    const [reduceQuery, thresholdQuery] = getDefaultExpressions('X', 'Y');

    expect(reduceQuery).toMatchObject({ refId: 'X', model: { refId: 'X' } });
    expect(thresholdQuery).toMatchObject({ refId: 'Y', model: { refId: 'Y', expression: 'X' } });
  });
});

describe('fixMissingRefIdsInExpressionModel', () => {
  it('should return non-Grafana managed rules unchanged', () => {
    const cloudAlertingRule: RulerAlertingRuleDTO = {
      alert: 'CloudAlert',
      expr: 'up == 0',
      for: '5m',
      labels: { severity: 'critical' },
      annotations: { summary: 'Instance down' },
    };

    const result = fixMissingRefIdsInExpressionModel(cloudAlertingRule);

    expect(result).toEqual(cloudAlertingRule);
    expect(result).toBe(cloudAlertingRule); // should be the exact same reference
  });

  it('should copy refId from query to model when model.refId is missing in Grafana managed rules', () => {
    const ruleWithMissingRefId: RulerGrafanaRuleDTO = {
      grafana_alert: {
        uid: 'test-uid',
        title: 'Test Alert',
        namespace_uid: 'namespace-uid',
        rule_group: 'test-group',
        condition: 'B',
        no_data_state: GrafanaAlertStateDecision.NoData,
        exec_err_state: GrafanaAlertStateDecision.Alerting,
        is_paused: false,
        data: [
          {
            refId: 'A',
            datasourceUid: 'datasource-uid',
            queryType: '',
            relativeTimeRange: { from: 600, to: 0 },
            // @ts-ignore
            model: {
              // refId is missing here
              datasource: {
                type: 'grafana-testdata-datasource',
                uid: 'PD8C576611E62080A',
              },
            },
          },
          {
            refId: 'B',
            datasourceUid: ExpressionDatasourceUID,
            queryType: '',
            // @ts-ignore
            model: {
              // refId is missing here
              type: ExpressionQueryType.reduce,
              expression: 'A',
            },
          },
        ],
      },
      for: '5m',
      labels: {},
      annotations: {},
    };

    const result = fixMissingRefIdsInExpressionModel(ruleWithMissingRefId);

    expect(result.grafana_alert.data[0].model.refId).toBe('A');
    expect(result.grafana_alert.data[1].model.refId).toBe('B');
  });
});

describe('reading expression models out of a saved rule', () => {
  /** A rule whose classic condition predates the reducer field, as provisioned rules often are. */
  function ruleWithClassicConditionMissingReducer() {
    return mockRulerGrafanaRule(
      {},
      {
        condition: 'B',
        data: [
          { datasourceUid: 'prom-uid', refId: 'A', queryType: '', model: { refId: 'A' } },
          {
            datasourceUid: ExpressionDatasourceUID,
            refId: 'B',
            queryType: 'expression',
            model: {
              refId: 'B',
              type: ExpressionQueryType.classic,
              datasource: { type: '__expr__', uid: ExpressionDatasourceUID },
              conditions: [
                {
                  type: 'query',
                  evaluator: { params: [0], type: EvalFunction.IsAbove },
                  query: { params: ['A'] },
                },
              ],
            } as unknown as AlertDataQuery,
          },
        ],
      }
    );
  }

  // The editor reads condition.reducer.type without checking, so a rule saved without one used to
  // break it. Filling that in is now the read boundary's job.
  it('fills in a classic condition reducer via rulerRuleToFormValues', () => {
    const rule = ruleWithClassicConditionMissingReducer();
    const result = rulerRuleToFormValues(
      mockRuleWithLocation(rule, {
        ruleSourceName: GRAFANA_RULES_SOURCE_NAME,
        namespace: 'Test Folder',
        group: { name: 'my-group', interval: '1m', rules: [rule] },
      })
    );

    expect(result.queries[1].model).toMatchObject({
      conditions: [{ reducer: { params: [], type: 'avg' } }],
    });
  });

  it('fills in a classic condition reducer via grafanaRuleDtoToFormValues', () => {
    const result = grafanaRuleDtoToFormValues(ruleWithClassicConditionMissingReducer(), 'Test Folder');

    expect(result.queries[1].model).toMatchObject({
      conditions: [{ reducer: { params: [], type: 'avg' } }],
    });
  });

  it('leaves data queries alone', () => {
    const result = grafanaRuleDtoToFormValues(ruleWithClassicConditionMissingReducer(), 'Test Folder');

    expect(result.queries[0].model).toEqual({ refId: 'A' });
  });

  it('keeps fields on the expression model that we do not describe', () => {
    const rule = mockRulerGrafanaRule(
      {},
      {
        condition: 'B',
        data: [
          {
            datasourceUid: ExpressionDatasourceUID,
            refId: 'B',
            queryType: 'expression',
            model: {
              refId: 'B',
              type: ExpressionQueryType.reduce,
              expression: 'A',
              reducer: 'last',
              intervalMs: 1000,
              maxDataPoints: 43200,
            } as unknown as AlertDataQuery,
          },
        ],
      }
    );

    const result = grafanaRuleDtoToFormValues(rule, 'Test Folder');

    expect(result.queries[0].model).toMatchObject({ intervalMs: 1000, maxDataPoints: 43200 });
  });

  it('leaves an expression it cannot read in place, for setQueryEditorSettings to deal with', () => {
    const rule = mockRulerGrafanaRule(
      {},
      {
        condition: 'B',
        data: [
          {
            datasourceUid: ExpressionDatasourceUID,
            refId: 'B',
            queryType: 'expression',
            // No type at all - this can come from a dashboard panel or the API
            model: { refId: 'B' } as unknown as AlertDataQuery,
          },
        ],
      }
    );

    const result = grafanaRuleDtoToFormValues(rule, 'Test Folder');

    expect(result.queries).toHaveLength(1);
    expect(result.queries[0].model).toEqual({ refId: 'B' });
  });
});

describe('writing expression models back out', () => {
  function formValuesWithExpressions(model: unknown): RuleFormValues {
    return {
      ...getDefaultFormValues(),
      name: 'test',
      type: RuleFormType.grafana,
      condition: 'B',
      queries: [
        { datasourceUid: 'prom-uid', refId: 'A', queryType: '', model: { refId: 'A' } },
        {
          datasourceUid: ExpressionDatasourceUID,
          refId: 'B',
          queryType: 'expression',
          model: model as AlertDataQuery,
        },
      ],
    };
  }

  // The backend rejects `settings: null` outright, so the key has to be absent rather than nulled.
  it('leaves settings out of a reduce rather than sending null', () => {
    const values = formValuesWithExpressions({
      refId: 'B',
      type: ExpressionQueryType.reduce,
      expression: 'A',
      reducer: 'last',
    });

    const dto = formValuesToRulerGrafanaRuleDTO(values);
    const written = dto.grafana_alert.data[1].model;

    expect(Object.keys(written)).not.toContain('settings');
  });

  it('keeps settings when the reduce actually has some', () => {
    const values = formValuesWithExpressions({
      refId: 'B',
      type: ExpressionQueryType.reduce,
      expression: 'A',
      reducer: 'last',
      settings: { mode: 'dropNN' },
    });

    const dto = formValuesToRulerGrafanaRuleDTO(values);

    expect(dto.grafana_alert.data[1].model).toMatchObject({ settings: { mode: 'dropNN' } });
  });

  it('keeps hysteresis state on a threshold, so saving an unrelated edit does not re-fire the alert', () => {
    const values = formValuesWithExpressions({
      refId: 'B',
      type: ExpressionQueryType.threshold,
      expression: 'A',
      conditions: [
        {
          evaluator: { type: EvalFunction.IsAbove, params: [10] },
          unloadEvaluator: { type: EvalFunction.IsBelow, params: [5] },
          loadedFingerprints: ['18446744073709551615'],
        },
      ],
    });

    const dto = formValuesToRulerGrafanaRuleDTO(values);

    expect(dto.grafana_alert.data[1].model).toMatchObject({
      conditions: [{ loadedFingerprints: ['18446744073709551615'] }],
    });
  });

  it('keeps fields we do not describe', () => {
    const values = formValuesWithExpressions({
      refId: 'B',
      type: ExpressionQueryType.reduce,
      expression: 'A',
      reducer: 'last',
      intervalMs: 1000,
    });

    const dto = formValuesToRulerGrafanaRuleDTO(values);

    expect(dto.grafana_alert.data[1].model).toMatchObject({ intervalMs: 1000 });
  });

  it('leaves data queries untouched', () => {
    const values = formValuesWithExpressions({
      refId: 'B',
      type: ExpressionQueryType.reduce,
      expression: 'A',
      reducer: 'last',
    });

    const dto = formValuesToRulerGrafanaRuleDTO(values);

    expect(dto.grafana_alert.data[0].model).toEqual({ refId: 'A' });
  });
});

describe('round trip through the API shape', () => {
  it('a rule read, written and read again comes back the same', () => {
    const savedModel = {
      refId: 'B',
      type: ExpressionQueryType.threshold,
      datasource: { type: '__expr__', uid: ExpressionDatasourceUID },
      expression: 'A',
      conditions: [{ evaluator: { type: EvalFunction.IsAbove, params: [10] } }],
      intervalMs: 1000,
    };

    const rule = mockRulerGrafanaRule(
      {},
      {
        condition: 'B',
        data: [
          { datasourceUid: 'prom-uid', refId: 'A', queryType: '', model: { refId: 'A' } },
          {
            datasourceUid: ExpressionDatasourceUID,
            refId: 'B',
            queryType: 'expression',
            model: savedModel as unknown as AlertDataQuery,
          },
        ],
      }
    );

    const firstRead = grafanaRuleDtoToFormValues(rule, 'Test Folder');
    const written = formValuesToRulerGrafanaRuleDTO({ ...firstRead, name: 'test', condition: 'B' });
    const secondRead = grafanaRuleDtoToFormValues(
      { ...rule, grafana_alert: { ...rule.grafana_alert, data: written.grafana_alert.data } },
      'Test Folder'
    );

    expect(secondRead.queries).toEqual(firstRead.queries);
  });
});
