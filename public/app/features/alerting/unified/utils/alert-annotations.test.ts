import { EvalFunction } from '../../state/alertDef';
import { mockDataQuery, mockReduceExpression, mockThresholdExpression } from '../mocks';
import { getDefaultFormValues } from '../rule-editor/formDefaults';
import { RuleFormType, type RuleFormValues } from '../types/rule-form';

import {
  ensureAlertAnnotations,
  generateAlertDescriptionForGrafanaRule,
  getMissingRequiredAnnotationFields,
  validateRequiredAlertAnnotations,
} from './alert-annotations';
import { Annotation } from './constants';
import { formValuesToRulerGrafanaRuleDTO } from './rule-form';

function buildGrafanaAlertValues(overrides: Partial<RuleFormValues> = {}): RuleFormValues {
  const dataQuery = mockDataQuery({ refId: 'A' });
  Object.assign(dataQuery.model, { expr: 'up{job="api"} == 0' });

  const reduceQuery = mockReduceExpression({ refId: 'B', expression: 'A', reducer: 'last' });

  const thresholdQuery = mockThresholdExpression({
    refId: 'C',
    expression: 'B',
    conditions: [
      {
        type: 'query',
        evaluator: { params: [0], type: EvalFunction.IsAbove },
        operator: { type: 'and' },
        query: { params: ['C'] },
        reducer: { params: [], type: 'last' },
      },
    ],
  });

  return {
    ...getDefaultFormValues(RuleFormType.grafana),
    name: 'API availability',
    type: RuleFormType.grafana,
    condition: 'C',
    queries: [dataQuery, reduceQuery, thresholdQuery],
    evaluateFor: '5m',
    evaluateEvery: '1m',
    annotations: [
      { key: Annotation.summary, value: '' },
      { key: Annotation.description, value: '' },
      { key: Annotation.runbookURL, value: '' },
    ],
    ...overrides,
  };
}

describe('ensureAlertAnnotations', () => {
  it('fills missing summary and description for Grafana-managed alerting rules', () => {
    const result = ensureAlertAnnotations(buildGrafanaAlertValues());

    expect(result.annotations.find((annotation) => annotation.key === Annotation.summary)?.value).toBe(
      'API availability: last() is above 0'
    );
    expect(result.annotations.find((annotation) => annotation.key === Annotation.description)?.value).toContain(
      'Alert rule "API availability" monitors query A: up{job="api"} == 0'
    );
  });

  it('does not overwrite existing summary or description', () => {
    const result = ensureAlertAnnotations(
      buildGrafanaAlertValues({
        annotations: [
          { key: Annotation.summary, value: 'Custom summary' },
          { key: Annotation.description, value: 'Custom description' },
        ],
      })
    );

    expect(result.annotations).toEqual([
      { key: Annotation.summary, value: 'Custom summary' },
      { key: Annotation.description, value: 'Custom description' },
    ]);
  });

  it('leaves recording rules unchanged', () => {
    const values = {
      ...getDefaultFormValues(RuleFormType.grafanaRecording),
      name: 'recording_rule',
      type: RuleFormType.grafanaRecording,
      annotations: [{ key: Annotation.summary, value: '' }],
    };

    expect(ensureAlertAnnotations(values)).toBe(values);
  });
});

describe('validateRequiredAlertAnnotations', () => {
  it('reports missing summary and description for alerting rules', () => {
    expect(getMissingRequiredAnnotationFields(buildGrafanaAlertValues())).toEqual(['summary', 'description']);
  });

  it('passes when summary and description are present', () => {
    const values = buildGrafanaAlertValues({
      annotations: [
        { key: Annotation.summary, value: 'Summary' },
        { key: Annotation.description, value: 'Description' },
      ],
    });

    expect(getMissingRequiredAnnotationFields(values)).toEqual([]);
    expect(validateRequiredAlertAnnotations(values, jest.fn())).toBe(true);
  });

  it('sets field errors when required annotations are missing', () => {
    const setError = jest.fn();
    const values = buildGrafanaAlertValues();

    expect(validateRequiredAlertAnnotations(values, setError)).toBe(false);
    expect(setError).toHaveBeenCalledWith('annotations.0.value', expect.objectContaining({ type: 'required' }));
    expect(setError).toHaveBeenCalledWith('annotations.1.value', expect.objectContaining({ type: 'required' }));
  });
});

describe('generateAlertDescriptionForGrafanaRule', () => {
  it('generates a description from rule title and queries', () => {
    const dto = formValuesToRulerGrafanaRuleDTO(buildGrafanaAlertValues());
    const description = generateAlertDescriptionForGrafanaRule(dto);

    expect(description).toContain('Alert rule "API availability" monitors query A: up{job="api"} == 0');
    expect(description).toContain('It fires when last() is above 0');
    expect(description).toContain('The condition must hold for 5m before firing');
  });
});

describe('formValuesToRulerGrafanaRuleDTO', () => {
  it('does not auto-fill annotations during save conversion', () => {
    const dto = formValuesToRulerGrafanaRuleDTO(buildGrafanaAlertValues());

    expect(dto.annotations?.summary).toBeUndefined();
    expect(dto.annotations?.description).toBeUndefined();
  });
});
