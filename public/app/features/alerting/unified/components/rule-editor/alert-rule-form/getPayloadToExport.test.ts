import { ExpressionDatasourceUID, ExpressionQueryType } from 'app/features/expressions/types';
import { type RulerRuleDTO, type RulerRuleGroupDTO } from 'app/types/unified-alerting-dto';

import { EvalFunction } from '../../../../state/alertDef';
import { mockRulerGrafanaRecordingRule, mockRulerGrafanaRule } from '../../../mocks';
import { getDefaultFormValues } from '../../../rule-editor/formDefaults';
import { RuleFormType, type RuleFormValues } from '../../../types/rule-form';
import { Annotation } from '../../../utils/constants';
import { formValuesToRulerGrafanaRuleDTO } from '../../../utils/rule-form';

import { getPayloadToExport } from './ModifyExportRuleForm';

const rule1 = mockRulerGrafanaRule(
  {
    for: '1m',
    keep_firing_for: '1m',
    labels: { severity: 'critical', region: 'region1' },
    annotations: { [Annotation.summary]: 'This grafana rule1' },
  },
  { uid: 'uid-rule-1', title: 'Rule1', data: [] }
);

const rule2 = mockRulerGrafanaRule(
  {
    for: '1m',
    keep_firing_for: '1m',
    labels: { severity: 'notcritical', region: 'region2' },
    annotations: { [Annotation.summary]: 'This grafana rule2' },
  },
  { uid: 'uid-rule-2', title: 'Rule2', data: [] }
);

const rule3 = mockRulerGrafanaRule(
  {
    for: '1m',
    keep_firing_for: '1m',
    labels: { severity: 'notcritical3', region: 'region3' },
    annotations: { [Annotation.summary]: 'This grafana rule2' },
  },
  { uid: 'uid-rule-3', title: 'Rule3', data: [] }
);

const rule4 = mockRulerGrafanaRecordingRule(
  {
    labels: { severity: 'notcritical4', region: 'region4' },
    annotations: { [Annotation.summary]: 'This grafana rule4' },
    keep_firing_for: '1m',
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
  keepFiringFor: '1m',
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
    metadata: {
      editor_settings: {
        simplified_notifications_section: true,
        simplified_query_and_expressions_section: true,
      },
    },
    missing_series_evals_to_resolve: 0,
    no_data_state: 'NoData',
    notification_settings: undefined,
    title: 'Rule2 updated',
    uid: uid,
  },
  keep_firing_for: '1m',
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

const dynamicThresholdMetadata = {
  version: 1 as const,
  policy: {
    inputRefId: 'A',
    valueField: 'value',
    matchLabel: 'env',
    labelColumns: ['env'],
    evaluator: EvalFunction.IsAbove,
    mappings: [{ labelValue: 'prod', thresholds: [90] }],
    defaultThreshold: [100],
  },
};

describe('getPayloadToExport with dynamic threshold metadata', () => {
  const sqlModel = {
    refId: 'B',
    type: ExpressionQueryType.sql,
    expression: 'SELECT * FROM A',
    format: 'alerting',
  };
  const mathModel = { refId: 'C', type: ExpressionQueryType.math, expression: '$A > 1' };
  const thresholdModel = { refId: 'D', type: ExpressionQueryType.threshold, expression: 'A' };
  const expressionQuery = (model: { refId: string; [key: string]: unknown }) => ({
    refId: model.refId,
    datasourceUid: ExpressionDatasourceUID,
    queryType: '',
    model,
  });
  const formValues: RuleFormValues = {
    ...getDefaultFormValues(),
    type: RuleFormType.grafana,
    condition: 'B',
    name: 'Dynamic rule',
    queries: [
      expressionQuery({ ...sqlModel, dynamicThreshold: dynamicThresholdMetadata }),
      expressionQuery(mathModel),
      expressionQuery(thresholdModel),
    ],
  };
  const exportedModels = (payload: ReturnType<typeof getPayloadToExport>) =>
    payload.rules.flatMap((rule) => ('grafana_alert' in rule ? rule.grafana_alert.data.map((q) => q.model) : []));

  it('removes dynamicThreshold from the exported SQL model and keeps the generated SQL', () => {
    const payload = getPayloadToExport(formValues, undefined, 'uid-new');

    expect(exportedModels(payload)).toEqual([sqlModel, mathModel, thresholdModel]);
    expect(JSON.stringify(payload)).not.toContain('dynamicThreshold');
  });

  it('does not mutate the form values and keeps metadata on the normal save conversion', () => {
    getPayloadToExport(formValues, undefined, 'uid-new');

    expect(formValues.queries[0].model).toHaveProperty('dynamicThreshold', dynamicThresholdMetadata);
    const saved = formValuesToRulerGrafanaRuleDTO(formValues);
    expect(saved.grafana_alert.data[0].model).toHaveProperty('dynamicThreshold', dynamicThresholdMetadata);
  });

  it('strips metadata from rules already in the exported group', () => {
    const existing = mockRulerGrafanaRule(
      {},
      {
        uid: 'uid-existing',
        title: 'Existing',
        data: [expressionQuery({ ...sqlModel, dynamicThreshold: dynamicThresholdMetadata })],
      }
    );
    const group: RulerRuleGroupDTO<RulerRuleDTO> = { name: 'Group', rules: [existing] };

    const payload = getPayloadToExport(formValues, group, 'uid-new');

    expect(exportedModels(payload)).toEqual([sqlModel, sqlModel, mathModel, thresholdModel]);
    expect(existing.grafana_alert.data[0].model).toHaveProperty('dynamicThreshold');
  });

  it('leaves non-SQL expression and data source models carrying dynamicThreshold untouched', () => {
    const mathWithKey = { ...mathModel, dynamicThreshold: dynamicThresholdMetadata };
    const dataSourceModel = { refId: 'E', expr: 'up', dynamicThreshold: dynamicThresholdMetadata };
    const rule = mockRulerGrafanaRule(
      {},
      {
        uid: 'uid-existing',
        title: 'Existing',
        data: [
          expressionQuery(mathWithKey),
          { refId: 'E', datasourceUid: 'prom', queryType: '', model: dataSourceModel },
        ],
      }
    );

    const payload = getPayloadToExport(formValues, { name: 'Group', rules: [rule] }, 'uid-new');

    expect(payload.rules[0]).toBe(rule);
    expect(exportedModels(payload).slice(0, 2)).toEqual([mathWithKey, dataSourceModel]);
    expect(exportedModels(payload)[0]).toBe(mathWithKey);
    expect(exportedModels(payload)[1]).toBe(dataSourceModel);
  });

  it.each([undefined, null, 'text', 5])('does not throw and returns the rule unchanged when model is %p', (model) => {
    const rule = mockRulerGrafanaRule(
      {},
      {
        uid: 'uid-existing',
        title: 'Existing',
        data: [],
      }
    );
    // @ts-expect-error simulating malformed persisted data
    rule.grafana_alert.data.push({ refId: 'A', datasourceUid: 'prom', queryType: '', model });

    const payload = getPayloadToExport(formValues, { name: 'Group', rules: [rule] }, 'uid-new');

    expect(payload.rules[0]).toBe(rule);
  });
});
