import { config } from '@grafana/runtime';

import { mockDataSource } from '../mocks';
import { setupDataSources } from '../testSetup/datasources';

import {
  SUPPORTED_EXTERNAL_PROMETHEUS_FLAVORED_RULE_SOURCE_TYPES,
  getDefaultOrFirstCompatibleDataSource,
  getFirstCompatibleDataSource,
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

describe('getFirstCompatibleDataSource', () => {
  it('should return the first alerting-capable data source', async () => {
    setupDataSources(
      mockDataSource({ name: 'not-alerting', uid: 'ds-1' }, { alerting: false }),
      mockDataSource({ name: 'alerting-ds', uid: 'ds-2' }, { alerting: true })
    );

    const result = await getFirstCompatibleDataSource();
    expect(result?.uid).toBe('ds-2');
  });

  it('should return undefined when no alerting-capable data source exists', async () => {
    setupDataSources(mockDataSource({ name: 'not-alerting', uid: 'ds-1' }, { alerting: false }));

    const result = await getFirstCompatibleDataSource();
    expect(result).toBeUndefined();
  });
});

describe('getDefaultOrFirstCompatibleDataSource', () => {
  it('should return the default data source when it is alerting-capable', async () => {
    setupDataSources(
      mockDataSource({ name: 'default-ds', uid: 'ds-1', isDefault: true }, { alerting: true }),
      mockDataSource({ name: 'other-ds', uid: 'ds-2' }, { alerting: true })
    );

    const result = await getDefaultOrFirstCompatibleDataSource();
    expect(result?.uid).toBe('ds-1');
  });

  it('should fall back to the first alerting-capable data source when the default is not alerting-capable', async () => {
    setupDataSources(
      mockDataSource({ name: 'default-ds', uid: 'ds-1', isDefault: true }, { alerting: false }),
      mockDataSource({ name: 'other-ds', uid: 'ds-2' }, { alerting: true })
    );

    const result = await getDefaultOrFirstCompatibleDataSource();
    expect(result?.uid).toBe('ds-2');
  });

  it('should return undefined when no compatible data source exists', async () => {
    setupDataSources(mockDataSource({ name: 'default-ds', uid: 'ds-1', isDefault: true }, { alerting: false }));

    const result = await getDefaultOrFirstCompatibleDataSource();
    expect(result).toBeUndefined();
  });
});
