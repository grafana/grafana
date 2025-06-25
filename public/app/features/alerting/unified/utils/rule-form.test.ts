import { PromQuery } from '@grafana/prometheus';
import { RuleWithLocation } from 'app/types/unified-alerting';
import {
  AlertDataQuery,
  AlertQuery,
  GrafanaAlertStateDecision,
  GrafanaRuleDefinition,
  RulerAlertingRuleDTO,
} from 'app/types/unified-alerting-dto';

import { mockDataSource, mockRuleWithLocation, mockRulerGrafanaRecordingRule } from '../mocks';
import { getDefaultFormValues } from '../rule-editor/formDefaults';
import { setupDataSources } from '../testSetup/datasources';
import { AlertManagerManualRouting, RuleFormType, RuleFormValues } from '../types/rule-form';

import { DataSourceType, GRAFANA_RULES_SOURCE_NAME } from './datasource';
import {
  alertingRulerRuleToRuleForm,
  cleanAnnotations,
  cleanLabels,
  formValuesToRulerGrafanaRuleDTO,
  formValuesToRulerRuleDTO,
  getContactPointsFromDTO,
  getInstantFromDataQuery,
  getNotificationSettingsForDTO,
  rulerRuleToFormValues,
} from './rule-form';

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
