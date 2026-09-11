import { type DataSourceInstanceListItem } from '@grafana/data';
import { config } from '@grafana/runtime';

import { mockAlertQuery, mockDataSource, mockReduceExpression, mockThresholdExpression } from '../mocks';
import { setupDataSources } from '../testSetup/datasources';
import { RuleFormType } from '../types/rule-form';
import { Annotation } from '../utils/constants';
import { DataSourceType, getDefaultOrFirstCompatibleDataSource } from '../utils/datasource';
import { MANUAL_ROUTING_KEY, getDefaultQueries } from '../utils/rule-form';

import {
  formValuesFromPrefill,
  formValuesFromQueryParams,
  getDefaultFormValues,
  getDefautManualRouting,
} from './formDefaults';
import { isAlertQueryOfAlertData, isExpressionQueryInAlert } from './formProcessing';

jest.mock('../utils/datasource', () => ({
  ...jest.requireActual('../utils/datasource'),
  getDefaultOrFirstCompatibleDataSource: jest.fn(),
}));

const mocks = {
  getDefaultOrFirstCompatibleDataSource: jest.mocked(getDefaultOrFirstCompatibleDataSource),
};

// Setup mock implementation
mocks.getDefaultOrFirstCompatibleDataSource.mockResolvedValue(
  mockDataSource({
    type: DataSourceType.Prometheus,
  }) as DataSourceInstanceListItem
);

// TODO Not sure why queries are an empty array in the default form values
async function getExpectedDefaultFormValues() {
  return {
    ...getDefaultFormValues(),
    queries: await getDefaultQueries(),
  };
}

describe('formValuesFromQueryParams', () => {
  it('should return default values when given invalid JSON', async () => {
    const result = await formValuesFromQueryParams('invalid json', RuleFormType.grafana);

    expect(result).toEqual(await getExpectedDefaultFormValues());
  });

  it('should preserve evaluateEvery when provided', async () => {
    // "Continue in Alerting" from the panel drawer passes the rule's interval through this param;
    // it must not be overwritten with the default.
    const ruleDefinition = JSON.stringify({ evaluateEvery: '5m' });

    const result = await formValuesFromQueryParams(ruleDefinition, RuleFormType.grafana);

    expect(result.evaluateEvery).toBe('5m');
  });

  it('should fall back to the default evaluateEvery when not provided', async () => {
    const result = await formValuesFromQueryParams(JSON.stringify({}), RuleFormType.grafana);

    expect(result.evaluateEvery).toBe((await getExpectedDefaultFormValues()).evaluateEvery);
  });

  it('should normalize annotations', async () => {
    const ruleDefinition = JSON.stringify({
      annotations: [
        { key: 'custom', value: 'my custom annotation' },
        { key: Annotation.runbookURL, value: 'runbook annotation' },
        { key: 'custom-2', value: 'custom annotation v2' },
        { key: Annotation.summary, value: 'summary annotation' },
        { key: 'custom-3', value: 'custom annotation v3' },
        { key: Annotation.description, value: 'description annotation' },
      ],
    });

    const result = await formValuesFromQueryParams(ruleDefinition, RuleFormType.grafana);

    const [summary, description, runbookURL, ...rest] = result.annotations;

    expect(summary).toEqual({ key: Annotation.summary, value: 'summary annotation' });
    expect(description).toEqual({ key: Annotation.description, value: 'description annotation' });
    expect(runbookURL).toEqual({ key: Annotation.runbookURL, value: 'runbook annotation' });
    expect(rest).toContainEqual({ key: 'custom', value: 'my custom annotation' });
    expect(rest).toContainEqual({ key: 'custom-2', value: 'custom annotation v2' });
    expect(rest).toContainEqual({ key: 'custom-3', value: 'custom annotation v3' });
  });

  describe('when simplified query editor is enabled', () => {
    it('should enable simplified query editor if queries are transformable to simple condition', async () => {
      const result = await formValuesFromQueryParams(
        JSON.stringify({
          queries: [
            mockAlertQuery(),
            mockReduceExpression({ expression: 'A' }),
            mockThresholdExpression({ expression: 'B' }),
          ],
        }),
        RuleFormType.grafana
      );

      expect(result.editorSettings).toBeDefined();
      expect(result.editorSettings!.simplifiedQueryEditor).toBe(true);
    });

    it('should disable simplified query editor if queries are not transformable to simple condition', async () => {
      const result = await formValuesFromQueryParams(
        JSON.stringify({
          queries: [mockAlertQuery(), mockAlertQuery(), mockThresholdExpression({ expression: 'B' })],
        }),
        RuleFormType.grafana
      );

      expect(result.editorSettings).toBeDefined();
      expect(result.editorSettings!.simplifiedQueryEditor).toBe(false);
    });
  });

  it('should default to instant queries for loki and prometheus if not specified', async () => {
    const result = await formValuesFromQueryParams(
      JSON.stringify({
        queries: [
          mockAlertQuery({ datasourceUid: 'loki', model: { refId: 'A', datasource: { type: DataSourceType.Loki } } }),
          mockAlertQuery({
            datasourceUid: 'prometheus',
            model: { refId: 'B', datasource: { type: DataSourceType.Prometheus } },
          }),
        ],
      }),
      RuleFormType.grafana
    );

    const [lokiQuery, prometheusQuery] = result.queries.filter(isAlertQueryOfAlertData);

    expect(lokiQuery.model.instant).toBe(true);
    expect(lokiQuery.model.range).toBe(false);
    expect(prometheusQuery.model.instant).toBe(true);
    expect(prometheusQuery.model.range).toBe(false);
  });

  it('should preserver instant and range values if specified', async () => {
    const result = await formValuesFromQueryParams(
      JSON.stringify({
        queries: [
          mockAlertQuery({
            datasourceUid: 'loki',
            model: { refId: 'A', datasource: { type: DataSourceType.Loki }, instant: true, range: false },
          }),
          mockAlertQuery({
            datasourceUid: 'prometheus',
            model: { refId: 'B', datasource: { type: DataSourceType.Prometheus }, instant: false, range: true },
          }),
        ],
      }),
      RuleFormType.grafana
    );

    const [lokiQuery, prometheusQuery] = result.queries.filter(isAlertQueryOfAlertData);

    expect(lokiQuery.model.instant).toBe(true);
    expect(lokiQuery.model.range).toBe(false);
    expect(prometheusQuery.model.range).toBe(true);
    expect(prometheusQuery.model.instant).toBe(false);
  });

  it('should reveal hidden queries', async () => {
    const ruleDefinition = JSON.stringify({
      queries: [
        { refId: 'A', model: { refId: 'A', hide: true } },
        { refId: 'B', model: { refId: 'B', hide: false } },
        { refId: 'C', model: { refId: 'C' } },
      ],
    });

    const result = await formValuesFromQueryParams(ruleDefinition, RuleFormType.grafana);

    expect(result.queries.length).toBe(3);

    const [q1, q2, q3] = result.queries;
    expect(q1.refId).toBe('A');
    expect(q2.refId).toBe('B');
    expect(q3.refId).toBe('C');
    expect(q1.model).not.toHaveProperty('hide');
    expect(q2.model).not.toHaveProperty('hide');
    expect(q3.model).not.toHaveProperty('hide');
  });
});

describe('getDefaultManualRouting', () => {
  afterEach(() => {
    window.localStorage.clear();
  });

  it('returns true if localStorage is not set', () => {
    expect(getDefautManualRouting()).toBe(true);
  });

  it('returns false if localStorage is set to "false"', () => {
    localStorage.setItem(MANUAL_ROUTING_KEY, 'false');
    expect(getDefautManualRouting()).toBe(false);
  });

  it('returns true if localStorage is set to any value other than "false"', () => {
    localStorage.setItem(MANUAL_ROUTING_KEY, 'true');
    expect(getDefautManualRouting()).toBe(true);
    localStorage.removeItem(MANUAL_ROUTING_KEY);
    expect(getDefautManualRouting()).toBe(true);
  });
});

describe('getDefaultFormValues', () => {
  const grafanaConfig = config;
  const uaConfig = grafanaConfig.unifiedAlerting;

  afterEach(() => {
    uaConfig.defaultRecordingRulesTargetDatasourceUID = undefined;
  });

  it('should set targetDatasourceUid from config when datasource is valid for recording rules', () => {
    const expectedDatasourceUid = 'test-datasource-uid';
    uaConfig.defaultRecordingRulesTargetDatasourceUID = expectedDatasourceUid;

    setupDataSources(
      mockDataSource({
        uid: expectedDatasourceUid,
        type: DataSourceType.Prometheus,
        jsonData: {
          allowAsRecordingRulesTarget: true,
        },
      })
    );

    const result = getDefaultFormValues();

    expect(result.targetDatasourceUid).toBe(expectedDatasourceUid);
  });

  it('should set targetDatasourceUid to undefined when datasource has allowAsRecordingRulesTarget disabled', () => {
    const datasourceUid = 'test-datasource-uid';
    uaConfig.defaultRecordingRulesTargetDatasourceUID = datasourceUid;

    setupDataSources(
      mockDataSource({
        uid: datasourceUid,
        type: DataSourceType.Prometheus,
        jsonData: {
          allowAsRecordingRulesTarget: false,
        },
      })
    );

    const result = getDefaultFormValues();

    expect(result.targetDatasourceUid).toBeUndefined();
  });

  it('should set targetDatasourceUid to undefined when datasource type is not supported', () => {
    const datasourceUid = 'test-datasource-uid';
    uaConfig.defaultRecordingRulesTargetDatasourceUID = datasourceUid;

    setupDataSources(
      mockDataSource({
        uid: datasourceUid,
        type: DataSourceType.Loki,
        jsonData: {
          allowAsRecordingRulesTarget: true,
        },
      })
    );

    const result = getDefaultFormValues();

    expect(result.targetDatasourceUid).toBeUndefined();
  });

  it('should set targetDatasourceUid to undefined when datasource does not exist', () => {
    const datasourceUid = 'non-existent-datasource-uid';
    uaConfig.defaultRecordingRulesTargetDatasourceUID = datasourceUid;

    setupDataSources();

    const result = getDefaultFormValues();

    expect(result.targetDatasourceUid).toBeUndefined();
  });

  it('should set targetDatasourceUid to undefined when defaultRecordingRulesTargetDatasourceUID is not provided', () => {
    setupDataSources();

    const result = getDefaultFormValues();
    expect(result.targetDatasourceUid).toBeUndefined();
  });
});

describe('formValuesFromPrefill', () => {
  it('should preserve threshold expression query structure', async () => {
    const prefillData = {
      folder: { uid: 'test-folder', title: 'Test Folder' },
      group: 'test-group',
      queries: [
        {
          refId: 'A',
          datasourceUid: 'gdev-prometheus',
          queryType: '',
          relativeTimeRange: { from: 600, to: 0 },
          model: {
            datasource: { type: 'prometheus', uid: 'gdev-prometheus' },
            editorMode: 'code',
            exemplar: false,
            expr: 'sum by (handler) (rate(grafana_http_request_duration_seconds_count[5h]))',
            format: 'time_series',
            instant: true,
            intervalMs: 1000,
            legendFormat: '__auto',
            maxDataPoints: 43200,
            range: false,
            refId: 'A',
          },
        },
        {
          refId: 'C',
          datasourceUid: '__expr__',
          queryType: '',
          relativeTimeRange: { from: 600, to: 0 },
          model: {
            conditions: [
              {
                evaluator: { params: [0.0001, 0], type: 'gt' },
                operator: { type: 'and' },
                query: { params: [] },
                reducer: { params: [], type: 'avg' },
                type: 'query',
              },
            ],
            datasource: { name: 'Expression', type: '__expr__', uid: '__expr__' },
            expression: 'A',
            intervalMs: 1000,
            maxDataPoints: 43200,
            refId: 'C',
            type: 'threshold',
          },
        },
      ],
    };

    const result = await formValuesFromPrefill(prefillData);

    const queryC = result.queries.find((q) => q.refId === 'C');
    expect(queryC?.model).toHaveProperty('type', 'threshold');
    expect(queryC?.model).toHaveProperty('conditions');
    expect(queryC?.model).toHaveProperty('expression', 'A');
    expect(queryC?.model.datasource).toEqual({ name: 'Expression', type: '__expr__', uid: '__expr__' });

    // Should NOT have these defaults added
    expect(queryC?.model).not.toHaveProperty('instant');
    expect(queryC?.model).not.toHaveProperty('range');
  });

  it('should preserve reduce expression query structure', async () => {
    const prefillData = {
      queries: [
        {
          refId: 'B',
          datasourceUid: '-100',
          queryType: '',
          relativeTimeRange: { from: 0, to: 0 },
          model: {
            expression: 'A',
            intervalMs: 1000,
            maxDataPoints: 100,
            reducer: 'mean',
            refId: 'B',
            type: 'reduce',
          },
        },
      ],
    };

    const result = await formValuesFromPrefill(prefillData);
    const query = result.queries[0];

    expect(query.model).toHaveProperty('type', 'reduce');
    expect(query.model).toHaveProperty('reducer', 'mean');
    expect(query.model).toHaveProperty('expression', 'A');
    expect(query.model).not.toHaveProperty('instant');
    expect(query.model).not.toHaveProperty('range');
  });

  it('should preserve math expression query structure', async () => {
    const prefillData = {
      queries: [
        {
          refId: 'C',
          datasourceUid: '-100',
          queryType: '',
          relativeTimeRange: { from: 0, to: 0 },
          model: {
            conditions: [
              {
                evaluator: { params: [0, 0], type: 'gt' },
                operator: { type: 'and' },
                query: { params: ['B'] },
                reducer: { params: [], type: 'avg' },
                type: 'query',
              },
            ],
            datasource: { name: 'Expression', type: '__expr__', uid: '__expr__' },
            expression: '$B > 0.4',
            intervalMs: 1000,
            maxDataPoints: 43200,
            refId: 'C',
            type: 'math',
          },
        },
      ],
    };

    const result = await formValuesFromPrefill(prefillData);
    const query = result.queries[0];

    expect(query.model).toHaveProperty('type', 'math');
    expect(query.model).toHaveProperty('expression', '$B > 0.4');
    expect(query.model).toHaveProperty('conditions');
  });

  it('should preserve classic_conditions expression query structure', async () => {
    const prefillData = {
      queries: [
        {
          refId: 'B',
          datasourceUid: '-100',
          queryType: '',
          relativeTimeRange: { from: 0, to: 0 },
          model: {
            conditions: [
              {
                evaluator: { params: [10], type: 'gt' },
                operator: { type: 'and' },
                query: { params: ['A'] },
                reducer: { params: [], type: 'last' },
                type: 'query',
              },
              {
                evaluator: { params: [5, 15], type: 'within_range' },
                operator: { type: 'and' },
                query: { params: ['A'] },
                reducer: { params: [], type: 'avg' },
                type: 'query',
              },
            ],
            datasource: { type: '__expr__', uid: '-100' },
            expression: 'A',
            intervalMs: 1000,
            maxDataPoints: 43200,
            refId: 'B',
            type: 'classic_conditions',
          },
        },
      ],
    };

    const result = await formValuesFromPrefill(prefillData);
    const [query] = result.queries.filter(isExpressionQueryInAlert);

    expect(query.model).toHaveProperty('type', 'classic_conditions');
    expect(query.model.conditions).toHaveLength(2);
    expect(query.model.conditions?.[0].evaluator.type).toBe('gt');
    expect(query.model.conditions?.[1].evaluator.type).toBe('within_range');
  });

  it('should preserve resample expression query structure', async () => {
    const prefillData = {
      queries: [
        {
          refId: 'D',
          datasourceUid: '-100',
          queryType: '',
          relativeTimeRange: { from: 600, to: 0 },
          model: {
            conditions: [
              {
                evaluator: { params: [0, 0], type: 'gt' },
                operator: { type: 'and' },
                query: { params: [] },
                reducer: { params: [], type: 'avg' },
                type: 'query',
              },
            ],
            datasource: { name: 'Expression', type: '__expr__', uid: '__expr__' },
            downsampler: 'min',
            expression: 'A',
            intervalMs: 1000,
            maxDataPoints: 43200,
            refId: 'D',
            type: 'resample',
            upsampler: 'backfilling',
            window: '2m',
          },
        },
      ],
    };

    const result = await formValuesFromPrefill(prefillData);
    const query = result.queries[0];

    expect(query.model).toHaveProperty('type', 'resample');
    expect(query.model).toHaveProperty('downsampler', 'min');
    expect(query.model).toHaveProperty('upsampler', 'backfilling');
    expect(query.model).toHaveProperty('window', '2m');
  });

  it('should preserve Prometheus query fields', async () => {
    const prefillData = {
      queries: [
        {
          refId: 'A',
          datasourceUid: 'gdev-prometheus',
          queryType: '',
          relativeTimeRange: { from: 600, to: 0 },
          model: {
            datasource: { type: 'prometheus', uid: 'gdev-prometheus' },
            editorMode: 'code',
            exemplar: false,
            expr: 'rate(promhttp_metric_handler_requests_total{}[15m])',
            instant: true,
            intervalMs: 1000,
            legendFormat: '__auto',
            maxDataPoints: 43200,
            range: false,
            refId: 'A',
          },
        },
      ],
    };

    const result = await formValuesFromPrefill(prefillData);
    const [query] = result.queries.filter(isAlertQueryOfAlertData);

    expect(query.model).toHaveProperty('expr', 'rate(promhttp_metric_handler_requests_total{}[15m])');
    expect(query.model).toHaveProperty('editorMode', 'code');
    expect(query.model).toHaveProperty('exemplar', false);
    expect(query.model).toHaveProperty('legendFormat', '__auto');
    expect(query.model.instant).toBe(true);
    expect(query.model.range).toBe(false);
  });

  it('should not add default values to query models', async () => {
    const prefillData = {
      queries: [
        {
          refId: 'A',
          datasourceUid: 'test-uid',
          queryType: '',
          model: { refId: 'A' },
        },
      ],
    };

    const result = await formValuesFromPrefill(prefillData);
    const query = result.queries[0];

    // Should NOT have defaults added
    expect(query.model).not.toHaveProperty('instant');
    expect(query.model).not.toHaveProperty('range');
    expect(query.model).not.toHaveProperty('expression');
    expect(query.model).not.toHaveProperty('queryType');
  });

  it('should preserve missingSeriesEvalsToResolve when duplicating a rule', async () => {
    const prefillData = {
      type: RuleFormType.grafana,
      missingSeriesEvalsToResolve: 5,
    };

    const result = await formValuesFromPrefill(prefillData);

    expect(result.missingSeriesEvalsToResolve).toBe(5);
  });
});
