import { RulerRuleDTO, RulerRuleGroupDTO } from 'app/types/unified-alerting-dto';

import { mockRulerGrafanaRecordingRule, mockRulerGrafanaRule } from '../../../mocks';
import { RuleFormType, RuleFormValues } from '../../../types/rule-form';
import { Annotation } from '../../../utils/constants';
import { getDefaultFormValues } from '../../../utils/rule-form';

import { getPayloadToExport } from './ModifyExportRuleForm';

const rule1 = mockRulerGrafanaRule(
  {
    for: '1m',
    labels: { severity: 'critical', region: 'region1' },
    annotations: { [Annotation.summary]: 'This grafana rule1' },
  },
  { uid: 'uid-rule-1', title: 'Rule1', data: [] }
);

const rule2 = mockRulerGrafanaRule(
  {
    for: '1m',
    labels: { severity: 'notcritical', region: 'region2' },
    annotations: { [Annotation.summary]: 'This grafana rule2' },
  },
  { uid: 'uid-rule-2', title: 'Rule2', data: [] }
);

const rule3 = mockRulerGrafanaRule(
  {
    for: '1m',
    labels: { severity: 'notcritical3', region: 'region3' },
    annotations: { [Annotation.summary]: 'This grafana rule2' },
  },
  { uid: 'uid-rule-3', title: 'Rule3', data: [] }
);

const rule4 = mockRulerGrafanaRecordingRule(
  {
    labels: { severity: 'notcritical4', region: 'region4' },
    annotations: { [Annotation.summary]: 'This grafana rule4' },
  },
  { uid: 'uid-rule-4', title: 'Rule4', data: [] }
);

// Prepare the form values for rule2 updated
const defaultValues = getDefaultFormValues();
const formValuesForRule2Updated: RuleFormValues = {
  ...defaultValues,
  type: RuleFormType.grafana,
  queries: [
    {
      refId: 'A',
      relativeTimeRange: { from: 900, to: 1000 },
      datasourceUid: 'dsuid',
      model: {
        refId: 'A',
        hide: true,
      },
      queryType: 'query',
    },
  ],
  condition: 'A',
  forTime: 2455,
  name: 'Rule2 updated',
  labels: [{ key: 'newLabel', value: 'newLabel' }],
  annotations: [{ key: 'summary', value: 'This grafana rule2 updated' }],
};
const formValuesForRecordingRule4Updated: RuleFormValues = {
  ...defaultValues,
  type: RuleFormType.grafanaRecording,
  queries: [
    {
      refId: 'A',
      relativeTimeRange: { from: 900, to: 1000 },
      datasourceUid: 'dsuid',
      model: {
        refId: 'A',
        hide: true,
      },
      queryType: 'query',
    },
  ],
  condition: 'A',
  name: 'Rule4 updated',
  labels: [{ key: 'newLabel', value: 'newLabel' }],
  annotations: [{ key: 'summary', value: 'This grafana rule4 updated' }],
};

const expectedModifiedRule2 = (uid: string) => ({
  annotations: {
    summary: 'This grafana rule2 updated',
  },
  for: '1m',
  grafana_alert: {
    condition: 'A',
    data: [
      {
        datasourceUid: 'dsuid',
        model: {
          refId: 'A',
          hide: true,
        },
        queryType: 'query',
        refId: 'A',
        relativeTimeRange: {
          from: 900,
          to: 1000,
        },
      },
    ],
    exec_err_state: 'Error',
    is_paused: false,
    no_data_state: 'NoData',
    title: 'Rule2 updated',
    uid: uid,
  },
  labels: {
    newLabel: 'newLabel',
  },
});

const expectedModifiedRule4 = (uid: string) => ({
  annotations: {
    summary: 'This grafana rule4 updated',
  },
  grafana_alert: {
    condition: 'A',
    data: [
      {
        datasourceUid: 'dsuid',
        model: {
          refId: 'A',
          hide: true,
        },
        queryType: 'query',
        refId: 'A',
        relativeTimeRange: {
          from: 900,
          to: 1000,
        },
      },
    ],
    is_paused: false,
    notification_settings: undefined,
    record: {
      metric: 'Rule4 updated',
      from: 'A',
    },
    title: 'Rule4 updated',
    uid: uid,
  },
  labels: {
    newLabel: 'newLabel',
  },
});

describe('getPayloadFromDto', () => {
  const groupDto: RulerRuleGroupDTO<RulerRuleDTO> = {
    name: 'Test Group',
    rules: [rule1, rule2, rule3, rule4],
  };

  it('should return a ModifyExportPayload with the updated rule added to a group with this rule belongs, in the same position', () => {
    // for alerting rule
    const resultForAlerting = getPayloadToExport(formValuesForRule2Updated, groupDto, 'uid-rule-2');
    expect(resultForAlerting).toEqual({
      name: 'Test Group',
      rules: [rule1, expectedModifiedRule2('uid-rule-2'), rule3, rule4],
    });
    // for recording rule
    const resultForRecording = getPayloadToExport(
      { ...formValuesForRecordingRule4Updated, type: RuleFormType.grafanaRecording },
      groupDto,
      'uid-rule-4'
    );
    expect(resultForRecording).toEqual({
      name: 'Test Group',
      rules: [rule1, rule2, rule3, expectedModifiedRule4('uid-rule-4')],
    });
  });
  it('should return a ModifyExportPayload with the updated rule added to a non empty rule where this rule does not belong, in the last position', () => {
    // for alerting rule
    const result = getPayloadToExport(formValuesForRule2Updated, groupDto, 'uid-rule-5');
    expect(result).toEqual({
      name: 'Test Group',
      rules: [rule1, rule2, rule3, rule4, expectedModifiedRule2('uid-rule-5')],
    });
    // for recording rule
    const resultForRecording = getPayloadToExport(
      { ...formValuesForRecordingRule4Updated, type: RuleFormType.grafanaRecording },
      groupDto,
      'uid-rule-5'
    );
    expect(resultForRecording).toEqual({
      name: 'Test Group',
      rules: [rule1, rule2, rule3, rule4, expectedModifiedRule4('uid-rule-5')],
    });
  });

  it('should return a ModifyExportPayload with the updated rule added to an empty group', () => {
    const emptyGroupDto: RulerRuleGroupDTO<RulerRuleDTO> = {
      name: 'Empty Group',
      rules: [],
    };
    const result = getPayloadToExport(formValuesForRule2Updated, emptyGroupDto, 'uid-rule-2');
    expect(result).toEqual({
      name: 'Empty Group',
      rules: [expectedModifiedRule2('uid-rule-2')],
    });
  });
});
