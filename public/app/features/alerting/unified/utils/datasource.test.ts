import { config } from '@grafana/runtime';

import { mockDataSource } from '../mocks';

import { hasPromOrLokiQueryModel, isDataSourceManagingAlerts, isSupportedExternalRulesSourceType } from './datasource';

describe('isDataSourceManagingAlerts', () => {
  it('should return true when the prop is set as true', () => {
    expect(
      isDataSourceManagingAlerts(
        mockDataSource({
          jsonData: {
            manageAlerts: true,
          },
        })
      )
    ).toBe(true);
  });

  it('should return false when the prop is set as false', () => {
    expect(
      isDataSourceManagingAlerts(
        mockDataSource({
          jsonData: {
            manageAlerts: false,
          },
        })
      )
    ).toBe(false);
  });

  describe('when manageAlerts is undefined', () => {
    it('should use the config default when true', () => {
      config.defaultDatasourceManageAlertsUiToggle = true;

      expect(
        isDataSourceManagingAlerts(
          mockDataSource({
            jsonData: {},
          })
        )
      ).toBe(true);
    });

    it('should use the config default when false', () => {
      config.defaultDatasourceManageAlertsUiToggle = false;

      expect(
        isDataSourceManagingAlerts(
          mockDataSource({
            jsonData: {},
          })
        )
      ).toBe(false);
    });
  });
});

describe('isSupportedExternalRulesSourceType', () => {
  it.each([
    { type: 'prometheus', expected: true },
    { type: 'loki', expected: true },
    { type: 'victoriametrics-metrics-datasource', expected: true },
    { type: 'victoriametrics-logs-datasource', expected: true },
    { type: 'elasticsearch', expected: false },
  ])('returns $expected for $type', ({ type, expected }) => {
    expect(isSupportedExternalRulesSourceType(type)).toBe(expected);
  });
});

describe('hasPromOrLokiQueryModel', () => {
  it.each([
    { type: 'prometheus', expected: true },
    { type: 'loki', expected: true },
    { type: 'victoriametrics-metrics-datasource', expected: true },
    { type: 'victoriametrics-logs-datasource', expected: false },
    { type: 'elasticsearch', expected: false },
  ])('returns $expected for $type', ({ type, expected }) => {
    expect(hasPromOrLokiQueryModel(type)).toBe(expected);
  });
});
