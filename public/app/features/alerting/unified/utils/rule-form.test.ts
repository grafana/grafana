import { config } from '@grafana/runtime';
import { PromQuery } from 'app/plugins/datasource/prometheus/types';
import { GrafanaAlertStateDecision, GrafanaRuleDefinition, RulerAlertingRuleDTO } from 'app/types/unified-alerting-dto';

import { AlertManagerManualRouting, RuleFormType, RuleFormValues } from '../types/rule-form';

import { GRAFANA_RULES_SOURCE_NAME } from './datasource';
import {
  MANUAL_ROUTING_KEY,
  alertingRulerRuleToRuleForm,
  formValuesToRulerGrafanaRuleDTO,
  formValuesToRulerRuleDTO,
  getContactPointsFromDTO,
  getDefaultFormValues,
  getDefautManualRouting,
  getNotificationSettingsForDTO,
} from './rule-form';

describe('formValuesToRulerGrafanaRuleDTO', () => {
  it('should correctly convert rule form values', () => {
    const formValues: RuleFormValues = {
      ...getDefaultFormValues(),
      condition: 'A',
    };

    expect(formValuesToRulerGrafanaRuleDTO(formValues)).toMatchSnapshot();
  });

  it('should not save both instant and range type queries', () => {
    const defaultValues = getDefaultFormValues();

    const values: RuleFormValues = {
      ...defaultValues,
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
describe('getContactPointsFromDTO', () => {
  it('should return undefined if notification_settings is not defined', () => {
    const ga: GrafanaRuleDefinition = {
      uid: '123',
      title: 'myalert',
      namespace_uid: '123',
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
      title: 'myalert',
      namespace_uid: '123',
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
      group_by: ['group_by'],
      group_wait: 'group_wait',
      group_interval: 'group_interval',
      repeat_interval: 'repeat_interval',
    });
  });
});

describe('getDefautManualRouting', () => {
  afterEach(() => {
    window.localStorage.clear();
  });

  it('returns false if the feature toggle is not enabled', () => {
    config.featureToggles.alertingSimplifiedRouting = false;
    expect(getDefautManualRouting()).toBe(false);
  });

  it('returns true if the feature toggle is enabled and localStorage is not set', () => {
    config.featureToggles.alertingSimplifiedRouting = true;
    expect(getDefautManualRouting()).toBe(true);
  });

  it('returns false if the feature toggle is enabled and localStorage is set to "false"', () => {
    config.featureToggles.alertingSimplifiedRouting = true;
    localStorage.setItem(MANUAL_ROUTING_KEY, 'false');
    expect(getDefautManualRouting()).toBe(false);
  });

  it('returns true if the feature toggle is enabled and localStorage is set to any value other than "false"', () => {
    config.featureToggles.alertingSimplifiedRouting = true;
    localStorage.setItem(MANUAL_ROUTING_KEY, 'true');
    expect(getDefautManualRouting()).toBe(true);
    localStorage.removeItem(MANUAL_ROUTING_KEY);
    expect(getDefautManualRouting()).toBe(true);
  });
});
