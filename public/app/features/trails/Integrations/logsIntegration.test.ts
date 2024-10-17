import { DataSourceSettings } from '@grafana/data';

import { ExtractedRecordingRule, extractRecordingRules, RecordingRuleGroup } from './logsIntegration';
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

const mockDatasource: DataSourceSettings = {
  access: '',
  basicAuth: false,
  basicAuthUser: '',
  database: '',
  id: 10,
  isDefault: false,
  jsonData: {},
  name: 'My Test Datasource',
  orgId: 0,
  readOnly: false,
  secureJsonData: {},
  secureJsonFields: {},
  type: '',
  typeLogoUrl: '',
  typeName: '',
  uid: 'abcd123',
  url: '',
  user: '',
  withCredentials: false,
};
