import { mockDataSource } from '../mocks';

import {
  isDataSourceManagingAlerts,
  isValidRecordingRulesTarget,
  SUPPORTED_EXTERNAL_PROMETHEUS_FLAVORED_RULE_SOURCE_TYPES,
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

  it('should return true when the prop is undefined', () => {
    expect(
      isDataSourceManagingAlerts(
        mockDataSource({
          jsonData: {},
        })
      )
    ).toBe(true);
  });
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

describe('isValidRecordingRulesTarget', () => {
  it.each(SUPPORTED_EXTERNAL_PROMETHEUS_FLAVORED_RULE_SOURCE_TYPES)(
    'should return true for %s datasource with manageRecordingRulesTarget enabled',
    (type) => {
      expect(
        isValidRecordingRulesTarget(
          mockDataSource({
            type,
            jsonData: {
              manageRecordingRulesTarget: true,
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
            manageRecordingRulesTarget: true,
          },
        })
      )
    ).toBe(false);
  });
});
