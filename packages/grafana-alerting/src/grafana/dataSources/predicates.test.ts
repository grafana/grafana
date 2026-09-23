import {
  SUPPORTED_EXTERNAL_PROMETHEUS_FLAVORED_RULE_SOURCE_TYPES,
  isDataSourceAllowedAsRecordingRulesTarget,
  isValidRecordingRulesTarget,
} from './predicates';

describe('isDataSourceAllowedAsRecordingRulesTarget', () => {
  it.each([
    { allowAsRecordingRulesTarget: true, expected: true },
    { allowAsRecordingRulesTarget: undefined, expected: true },
    { allowAsRecordingRulesTarget: false, expected: false },
  ])('returns $expected when allowAsRecordingRulesTarget is $allowAsRecordingRulesTarget', (testCase) => {
    const { allowAsRecordingRulesTarget, expected } = testCase;

    expect(isDataSourceAllowedAsRecordingRulesTarget({ jsonData: { allowAsRecordingRulesTarget } })).toBe(expected);
  });
});

describe('isValidRecordingRulesTarget', () => {
  it.each(SUPPORTED_EXTERNAL_PROMETHEUS_FLAVORED_RULE_SOURCE_TYPES)(
    'accepts a %s data source that does not opt out',
    (type) => {
      expect(isValidRecordingRulesTarget({ type, jsonData: {} })).toBe(true);
    }
  );

  it.each(SUPPORTED_EXTERNAL_PROMETHEUS_FLAVORED_RULE_SOURCE_TYPES)(
    'rejects a %s data source with allowAsRecordingRulesTarget disabled',
    (type) => {
      expect(isValidRecordingRulesTarget({ type, jsonData: { allowAsRecordingRulesTarget: false } })).toBe(false);
    }
  );

  it.each(['loki', 'grafana', 'mixed'])('rejects a %s data source even when it allows recording rules', (type) => {
    expect(isValidRecordingRulesTarget({ type, jsonData: { allowAsRecordingRulesTarget: true } })).toBe(false);
  });
});
