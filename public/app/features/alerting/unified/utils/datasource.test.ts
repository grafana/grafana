import { config } from '@grafana/runtime';

import { mockDataSource } from '../mocks';

import { isDataSourceManagingAlerts } from './datasource';

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
