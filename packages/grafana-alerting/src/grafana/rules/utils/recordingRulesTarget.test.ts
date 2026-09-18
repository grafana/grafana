import { type DataSourceInstanceSettings, type DataSourceJsonData } from '@grafana/data';

import { SUPPORTED_EXTERNAL_PROMETHEUS_FLAVORED_RULE_SOURCE_TYPES, isValidRecordingRulesTarget } from './recordingRulesTarget';

function mockDataSource(
  partial: Partial<DataSourceInstanceSettings<DataSourceJsonData>> = {}
): DataSourceInstanceSettings<DataSourceJsonData> {
  return {
    id: 1,
    uid: 'mock-ds',
    type: 'prometheus',
    name: 'Prometheus',
    access: 'proxy',
    url: '/api/datasources/proxy/uid/mock-ds',
    jsonData: {},
    meta: {} as DataSourceInstanceSettings['meta'],
    readOnly: false,
    ...partial,
  };
}

describe('isValidRecordingRulesTarget', () => {
  it.each(SUPPORTED_EXTERNAL_PROMETHEUS_FLAVORED_RULE_SOURCE_TYPES)(
    'should return true for %s datasource with allowAsRecordingRulesTarget enabled',
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
    'should return true for %s datasource when allowAsRecordingRulesTarget is undefined (defaults to true)',
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

  it.each(SUPPORTED_EXTERNAL_PROMETHEUS_FLAVORED_RULE_SOURCE_TYPES)(
    'should return false for %s datasource with allowAsRecordingRulesTarget disabled',
    (type) => {
      expect(
        isValidRecordingRulesTarget(
          mockDataSource({
            type,
            jsonData: {
              allowAsRecordingRulesTarget: false,
            },
          })
        )
      ).toBe(false);
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
