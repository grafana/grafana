import { type DataSourceInstanceSettings } from '@grafana/data';
import { config } from '@grafana/runtime';

import {
  SUPPORTED_EXTERNAL_PROMETHEUS_FLAVORED_RULE_SOURCE_TYPES,
  isDataSourceAllowedAsRecordingRulesTarget,
  isDataSourceManagingAlerts,
  isValidRecordingRulesTarget,
} from './predicates';

function mockDataSource(partial: Partial<DataSourceInstanceSettings> = {}): DataSourceInstanceSettings {
  return {
    id: 1,
    uid: 'mock-ds',
    type: 'prometheus',
    name: 'Prometheus',
    access: 'proxy',
    jsonData: {},
    meta: {} as DataSourceInstanceSettings['meta'],
    readOnly: false,
    ...partial,
  };
}

describe('isDataSourceManagingAlerts', () => {
  const originalToggle = config.defaultDatasourceManageAlertsUiToggle;

  afterEach(() => {
    config.defaultDatasourceManageAlertsUiToggle = originalToggle;
  });

  it.each([true, false])('returns %s when manageAlerts is set to it, whatever the config default', (manageAlerts) => {
    config.defaultDatasourceManageAlertsUiToggle = !manageAlerts;

    expect(isDataSourceManagingAlerts(mockDataSource({ jsonData: { manageAlerts } }))).toBe(manageAlerts);
  });

  it.each([true, false])('returns the config default (%s) when manageAlerts is undefined', (defaultToggle) => {
    config.defaultDatasourceManageAlertsUiToggle = defaultToggle;

    expect(isDataSourceManagingAlerts(mockDataSource({ jsonData: {} }))).toBe(defaultToggle);
  });
});

describe('isDataSourceAllowedAsRecordingRulesTarget', () => {
  it.each([
    { allowAsRecordingRulesTarget: true, expected: true },
    { allowAsRecordingRulesTarget: undefined, expected: true },
    { allowAsRecordingRulesTarget: false, expected: false },
  ])('returns $expected when allowAsRecordingRulesTarget is $allowAsRecordingRulesTarget', (testCase) => {
    const { allowAsRecordingRulesTarget, expected } = testCase;

    expect(
      isDataSourceAllowedAsRecordingRulesTarget(mockDataSource({ jsonData: { allowAsRecordingRulesTarget } }))
    ).toBe(expected);
  });
});

describe('isValidRecordingRulesTarget', () => {
  it.each(SUPPORTED_EXTERNAL_PROMETHEUS_FLAVORED_RULE_SOURCE_TYPES)(
    'accepts a %s data source that does not opt out',
    (type) => {
      expect(isValidRecordingRulesTarget(mockDataSource({ type, jsonData: {} }))).toBe(true);
    }
  );

  it.each(SUPPORTED_EXTERNAL_PROMETHEUS_FLAVORED_RULE_SOURCE_TYPES)(
    'rejects a %s data source with allowAsRecordingRulesTarget disabled',
    (type) => {
      expect(
        isValidRecordingRulesTarget(mockDataSource({ type, jsonData: { allowAsRecordingRulesTarget: false } }))
      ).toBe(false);
    }
  );

  it.each(['loki', 'grafana', 'mixed'])('rejects a %s data source even when it allows recording rules', (type) => {
    expect(isValidRecordingRulesTarget(mockDataSource({ type, jsonData: { allowAsRecordingRulesTarget: true } }))).toBe(
      false
    );
  });
});
