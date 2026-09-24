import { config } from '@grafana/runtime';
import { AccessControlAction } from 'app/types/accessControl';

import { grantUserPermissions, mockDataSource } from '../mocks';
import { setupDataSources } from '../testSetup/datasources';

import {
  SUPPORTED_EXTERNAL_PROMETHEUS_FLAVORED_RULE_SOURCE_TYPES,
  getRulesDataSources,
  isDataSourceManagingAlerts,
  isValidRecordingRulesTarget,
} from './datasource';

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

describe('getRulesDataSources', () => {
  afterEach(() => {
    grantUserPermissions([]);
    setupDataSources();
  });

  it('optionally limits results to data sources with a URL', () => {
    grantUserPermissions([AccessControlAction.AlertingRuleExternalRead]);
    const configured = mockDataSource({ name: 'configured', jsonData: { manageAlerts: true } });
    const missingUrl = mockDataSource({ name: 'missing-url', url: '', jsonData: { manageAlerts: true } });
    setupDataSources(configured, missingUrl);

    expect(getRulesDataSources()).toEqual([configured, missingUrl]);
    expect(getRulesDataSources({ hasUrl: true })).toEqual([configured]);
  });
});

describe('isValidRecordingRulesTarget', () => {
  it.each(SUPPORTED_EXTERNAL_PROMETHEUS_FLAVORED_RULE_SOURCE_TYPES)(
    'should return true for %s datasource with manageRecordingRulesTarget enabled',
    (type) => {
      expect(
        isValidRecordingRulesTarget(
          mockDataSource({
            type,
            jsonData: {
              allowAsRecordingRulesTarget: true,
            },
          })
        )
      ).toBe(true);
    }
  );

  it.each(SUPPORTED_EXTERNAL_PROMETHEUS_FLAVORED_RULE_SOURCE_TYPES)(
    'should return true for %s datasource when manageRecordingRulesTarget is undefined (defaults to true)',
    (type) => {
      expect(
        isValidRecordingRulesTarget(
          mockDataSource({
            type,
            jsonData: {},
          })
        )
      ).toBe(true);
    }
  );

  it('should return false for loki datasource (unsupported type)', () => {
    expect(
      isValidRecordingRulesTarget(
        mockDataSource({
          type: 'loki',
          jsonData: {
            allowAsRecordingRulesTarget: true,
          },
        })
      )
    ).toBe(false);
  });
});
