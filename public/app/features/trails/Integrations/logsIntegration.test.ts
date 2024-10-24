import type { DataSourceInstanceSettings, DataSourceJsonData } from '@grafana/data';
import { getMockPlugin } from '@grafana/data/test/__mocks__/pluginMocks';

import { extractRecordingRules, type ExtractedRecordingRule, type RecordingRuleGroup } from './logsIntegration';
import noRulesJson from './testData/no-rules.json';
import withRulesJson from './testData/with-rules.json';

describe('logsIntegration', () => {
  describe('getLogsUidOfMetric', () => {
    it('should find the lokids uid', () => {});
  });

  describe('extractRecordingRules', () => {
    it('should return empty array from empty groups', () => {
      const testData: RecordingRuleGroup[] = noRulesJson.data.groups;
      const extractedRules: ExtractedRecordingRule[] = extractRecordingRules(testData, mockDatasource);
      expect(extractedRules.length).toBe(0);
    });

    it('should extract recording rules from groups', () => {
      const testData: RecordingRuleGroup[] = withRulesJson.data.groups;
      const extractedRules: ExtractedRecordingRule[] = extractRecordingRules(testData, mockDatasource);
      expect(extractedRules.length).toBeGreaterThan(0);
      extractedRules.forEach((rule) => {
        expect(rule.datasource.uid).toEqual(mockDatasource.uid);
      });
    });
  });
});

const mockDatasource: DataSourceInstanceSettings<DataSourceJsonData> = {
  access: 'proxy',
  database: '',
  id: 10,
  isDefault: false,
  jsonData: {},
  meta: {
    ...getMockPlugin(),
    id: 'loki',
  },
  name: 'My Test Datasource',
  readOnly: false,
  type: '',
  uid: 'abcd123',
  url: '',
  withCredentials: false,
};
