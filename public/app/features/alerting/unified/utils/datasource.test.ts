import { hasPromOrLokiQueryModel, isSupportedExternalRulesSourceType } from './datasource';

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
