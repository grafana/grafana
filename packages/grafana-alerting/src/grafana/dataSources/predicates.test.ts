import { type DataSourceInstanceSettings } from '@grafana/data';
import { config } from '@grafana/runtime';

import {
  SUPPORTED_EXTERNAL_PROMETHEUS_FLAVORED_RULE_SOURCE_TYPES,
  isAlertManagerWithConfigAPI,
  isDataSourceAllowedAsRecordingRulesTarget,
  isDataSourceManagingAlerts,
  isSupportedExternalRulesSourceType,
  isValidRecordingRulesTarget,
} from './predicates';
import { AlertManagerImplementation } from './types';

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

describe('isSupportedExternalRulesSourceType', () => {
  it.each(['loki', ...SUPPORTED_EXTERNAL_PROMETHEUS_FLAVORED_RULE_SOURCE_TYPES])('returns true for %s', (type) => {
    expect(isSupportedExternalRulesSourceType(type)).toBe(true);
  });

  it.each(['grafana', 'alertmanager', 'graphite', 'Loki', ''])('returns false for "%s"', (type) => {
    expect(isSupportedExternalRulesSourceType(type)).toBe(false);
  });
});

describe('isAlertManagerWithConfigAPI', () => {
  it.each([
    { implementation: undefined, expected: true },
    { implementation: AlertManagerImplementation.mimir, expected: true },
    { implementation: AlertManagerImplementation.cortex, expected: true },
    { implementation: AlertManagerImplementation.prometheus, expected: false },
  ])('returns $expected when implementation is $implementation', ({ implementation, expected }) => {
    expect(isAlertManagerWithConfigAPI({ implementation })).toBe(expected);
  });

  // jsonData is not validated against the enum, so it can hold values outside it. These rows pin today's
  // exact-match behavior, which the migration must keep.
  it.each([null, '', 'Mimir', 'mimr'])('returns false when implementation is %p', (implementation) => {
    const raw = implementation as unknown as AlertManagerImplementation;

    expect(isAlertManagerWithConfigAPI({ implementation: raw })).toBe(false);
  });
});
