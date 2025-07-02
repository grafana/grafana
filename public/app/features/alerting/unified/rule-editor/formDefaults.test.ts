import { GrafanaConfig } from '@grafana/data';
import { config, getDataSourceSrv } from '@grafana/runtime';

import { mockAlertQuery, mockDataSource, mockReduceExpression, mockThresholdExpression } from '../mocks';
import { testWithFeatureToggles } from '../test/test-utils';
import { RuleFormType } from '../types/rule-form';
import { Annotation } from '../utils/constants';
import { DataSourceType, getDefaultOrFirstCompatibleDataSource } from '../utils/datasource';
import { MANUAL_ROUTING_KEY, getDefaultQueries } from '../utils/rule-form';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getDataSourceSrv: jest.fn(),
}));

import { formValuesFromQueryParams, getDefaultFormValues, getDefautManualRouting } from './formDefaults';
import { isAlertQueryOfAlertData } from './formProcessing';

jest.mock('../utils/datasource', () => ({
  ...jest.requireActual('../utils/datasource'),
  getDefaultOrFirstCompatibleDataSource: jest.fn(),
}));

const mocks = {
  getDefaultOrFirstCompatibleDataSource: jest.mocked(getDefaultOrFirstCompatibleDataSource),
};

// Setup mock implementation
mocks.getDefaultOrFirstCompatibleDataSource.mockReturnValue(
  mockDataSource({
    type: DataSourceType.Prometheus,
  })
);

// TODO Not sure why queries are an empty array in the default form values
const defaultFormValues = {
  ...getDefaultFormValues(),
  queries: getDefaultQueries(),
};

describe('formValuesFromQueryParams', () => {
  it('should return default values when given invalid JSON', () => {
    const result = formValuesFromQueryParams('invalid json', RuleFormType.grafana);

    expect(result).toEqual(defaultFormValues);
  });

  it('should normalize annotations', () => {
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

    const result = formValuesFromQueryParams(ruleDefinition, RuleFormType.grafana);

    const [summary, description, runbookURL, ...rest] = result.annotations;

    expect(summary).toEqual({ key: Annotation.summary, value: 'summary annotation' });
    expect(description).toEqual({ key: Annotation.description, value: 'description annotation' });
    expect(runbookURL).toEqual({ key: Annotation.runbookURL, value: 'runbook annotation' });
    expect(rest).toContainEqual({ key: 'custom', value: 'my custom annotation' });
    expect(rest).toContainEqual({ key: 'custom-2', value: 'custom annotation v2' });
    expect(rest).toContainEqual({ key: 'custom-3', value: 'custom annotation v3' });
  });

  it('should disable simplified query editor when query switch mode is disabled', () => {
    const result = formValuesFromQueryParams(JSON.stringify({}), RuleFormType.grafana);

    expect(result.editorSettings).toBeDefined();
    expect(result.editorSettings!.simplifiedQueryEditor).toBe(false);
  });

  describe('when simplified query editor is enabled', () => {
    testWithFeatureToggles(['alertingQueryAndExpressionsStepMode']);

    it('should enable simplified query editor if queries are transformable to simple condition', () => {
      const result = formValuesFromQueryParams(
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

    it('should disable simplified query editor if queries are not transformable to simple condition', () => {
      const result = formValuesFromQueryParams(
        JSON.stringify({
          queries: [mockAlertQuery(), mockAlertQuery(), mockThresholdExpression({ expression: 'B' })],
        }),
        RuleFormType.grafana
      );

      expect(result.editorSettings).toBeDefined();
      expect(result.editorSettings!.simplifiedQueryEditor).toBe(false);
    });
  });

  it('should default to instant queries for loki and prometheus if not specified', () => {
    const result = formValuesFromQueryParams(
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

  it('should preserver instant and range values if specified', () => {
    const result = formValuesFromQueryParams(
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

  it('should reveal hidden queries', () => {
    const ruleDefinition = JSON.stringify({
      queries: [
        { refId: 'A', model: { refId: 'A', hide: true } },
        { refId: 'B', model: { refId: 'B', hide: false } },
        { refId: 'C', model: { refId: 'C' } },
      ],
    });

    const result = formValuesFromQueryParams(ruleDefinition, RuleFormType.grafana);

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
  // This is for Typescript. GrafanaBootConfig returns narrower types than GrafanaConfig
  const grafanaConfig: GrafanaConfig = config;
  const uaConfig = grafanaConfig.unifiedAlerting;

  const mockGetInstanceSettings = jest.fn();

  beforeEach(() => {
    (getDataSourceSrv as jest.Mock).mockReturnValue({
      getInstanceSettings: mockGetInstanceSettings,
    });
  });

  afterEach(() => {
    uaConfig.defaultRecordingRulesTargetDatasourceUID = undefined;
    jest.clearAllMocks();
  });

  it('should set targetDatasourceUid from config when datasource is valid for recording rules', () => {
    const expectedDatasourceUid = 'test-datasource-uid';
    uaConfig.defaultRecordingRulesTargetDatasourceUID = expectedDatasourceUid;

    const validDataSource = mockDataSource({
      uid: expectedDatasourceUid,
      type: DataSourceType.Prometheus,
      jsonData: {
        allowAsRecordingRulesTarget: true,
      },
    });
    mockGetInstanceSettings.mockReturnValue(validDataSource);

    const result = getDefaultFormValues();

    expect(result.targetDatasourceUid).toBe(expectedDatasourceUid);
    expect(mockGetInstanceSettings).toHaveBeenCalledWith(expectedDatasourceUid);
  });

  it('should set targetDatasourceUid to undefined when datasource has allowAsRecordingRulesTarget disabled', () => {
    const datasourceUid = 'test-datasource-uid';
    uaConfig.defaultRecordingRulesTargetDatasourceUID = datasourceUid;

    const invalidDataSource = mockDataSource({
      uid: datasourceUid,
      type: DataSourceType.Prometheus,
      jsonData: {
        allowAsRecordingRulesTarget: false,
      },
    });
    mockGetInstanceSettings.mockReturnValue(invalidDataSource);

    const result = getDefaultFormValues();

    expect(result.targetDatasourceUid).toBeUndefined();
    expect(mockGetInstanceSettings).toHaveBeenCalledWith(datasourceUid);
  });

  it('should set targetDatasourceUid to undefined when datasource type is not supported', () => {
    const datasourceUid = 'test-datasource-uid';
    uaConfig.defaultRecordingRulesTargetDatasourceUID = datasourceUid;

    const nonPrometheusDataSource = mockDataSource({
      uid: datasourceUid,
      type: DataSourceType.Loki,
      jsonData: {
        allowAsRecordingRulesTarget: true,
      },
    });
    mockGetInstanceSettings.mockReturnValue(nonPrometheusDataSource);

    const result = getDefaultFormValues();

    expect(result.targetDatasourceUid).toBeUndefined();
    expect(mockGetInstanceSettings).toHaveBeenCalledWith(datasourceUid);
  });

  it('should set targetDatasourceUid to undefined when datasource does not exist', () => {
    const datasourceUid = 'non-existent-datasource-uid';
    uaConfig.defaultRecordingRulesTargetDatasourceUID = datasourceUid;

    mockGetInstanceSettings.mockReturnValue(null);

    const result = getDefaultFormValues();

    expect(result.targetDatasourceUid).toBeUndefined();
    expect(mockGetInstanceSettings).toHaveBeenCalledWith(datasourceUid);
  });

  it('should set targetDatasourceUid to undefined when defaultRecordingRulesTargetDatasourceUID is not provided', () => {
    const result = getDefaultFormValues();
    expect(result.targetDatasourceUid).toBeUndefined();
    expect(mockGetInstanceSettings).not.toHaveBeenCalled();
  });
});
