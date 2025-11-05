import { AdHocFilterWithLabels } from '@grafana/scenes';

import { prometheusExpressionBuilder } from './expressionBuilder';

describe('prometheusExpressionBuilder', () => {
  it('should handle exact match operators', () => {
    const filters: AdHocFilterWithLabels[] = [{ key: 'alertname', operator: '=', value: 'foo' }];
    expect(prometheusExpressionBuilder(filters)).toBe('alertname="foo"');
  });

  it('should handle exact not-match operators', () => {
    const filters: AdHocFilterWithLabels[] = [{ key: 'alertname', operator: '!=', value: 'foo' }];
    expect(prometheusExpressionBuilder(filters)).toBe('alertname!="foo"');
  });

  it('should handle regex match operator without escaping metacharacters', () => {
    const filters: AdHocFilterWithLabels[] = [{ key: 'alertname', operator: '=~', value: 'foo.*' }];
    // Should NOT escape the .* regex pattern
    expect(prometheusExpressionBuilder(filters)).toBe('alertname=~"foo.*"');
  });

  it('should handle regex match with complex patterns', () => {
    const filters: AdHocFilterWithLabels[] = [{ key: 'alertname', operator: '=~', value: 'test[0-9]+' }];
    // Should preserve the regex pattern
    expect(prometheusExpressionBuilder(filters)).toBe('alertname=~"test[0-9]+"');
  });

  it('should handle regex not-match operator without escaping metacharacters', () => {
    const filters: AdHocFilterWithLabels[] = [{ key: 'alertname', operator: '!~', value: 'foo.*' }];
    expect(prometheusExpressionBuilder(filters)).toBe('alertname!~"foo.*"');
  });

  it('should escape quotes in regex values', () => {
    const filters: AdHocFilterWithLabels[] = [{ key: 'alertname', operator: '=~', value: 'foo"bar.*' }];
    expect(prometheusExpressionBuilder(filters)).toBe('alertname=~"foo\\"bar.*"');
  });

  it('should escape backslashes in regex values', () => {
    const filters: AdHocFilterWithLabels[] = [{ key: 'alertname', operator: '=~', value: 'foo\\bar.*' }];
    expect(prometheusExpressionBuilder(filters)).toBe('alertname=~"foo\\\\bar.*"');
  });

  it('should handle multi-value equals operator', () => {
    const filters: AdHocFilterWithLabels[] = [
      { key: 'alertname', operator: '=|', value: 'foo', values: ['foo', 'bar', 'baz'] },
    ];
    // Multi-value should escape regex metacharacters since we're building literal matches
    expect(prometheusExpressionBuilder(filters)).toBe('alertname=~"foo|bar|baz"');
  });

  it('should handle multi-value not-equals operator', () => {
    const filters: AdHocFilterWithLabels[] = [
      { key: 'alertname', operator: '!=|', value: 'foo', values: ['foo', 'bar', 'baz'] },
    ];
    expect(prometheusExpressionBuilder(filters)).toBe('alertname!~"foo|bar|baz"');
  });

  it('should escape metacharacters in multi-value operators', () => {
    const filters: AdHocFilterWithLabels[] = [
      { key: 'alertname', operator: '=|', value: 'foo.*', values: ['foo.*', 'bar+'] },
    ];
    // These should be escaped because we want literal matches
    // The backslashes themselves are escaped in the string literal
    expect(prometheusExpressionBuilder(filters)).toBe('alertname=~"foo\\\\.\\\\*|bar\\\\+"');
  });

  it('should handle multiple filters', () => {
    const filters: AdHocFilterWithLabels[] = [
      { key: 'alertname', operator: '=~', value: 'foo.*' },
      { key: 'severity', operator: '=', value: 'critical' },
      { key: 'team', operator: '!=', value: 'test' },
    ];
    expect(prometheusExpressionBuilder(filters)).toBe('alertname=~"foo.*",severity="critical",team!="test"');
  });

  it('should filter out non-applicable filters', () => {
    const filters: AdHocFilterWithLabels[] = [
      { key: 'alertname', operator: '=', value: 'foo' },
      { key: 'severity', operator: '=', value: 'critical', nonApplicable: true },
    ];
    expect(prometheusExpressionBuilder(filters)).toBe('alertname="foo"');
  });

  it('should filter out hidden filters', () => {
    const filters: AdHocFilterWithLabels[] = [
      { key: 'alertname', operator: '=', value: 'foo' },
      { key: 'severity', operator: '=', value: 'critical', hidden: true },
    ];
    expect(prometheusExpressionBuilder(filters)).toBe('alertname="foo"');
  });

  it('should escape special characters in exact match values', () => {
    const filters: AdHocFilterWithLabels[] = [{ key: 'alertname', operator: '=', value: 'foo"bar\nbaz' }];
    expect(prometheusExpressionBuilder(filters)).toBe('alertname="foo\\"bar\\nbaz"');
  });

  it('should handle empty filter array', () => {
    const filters: AdHocFilterWithLabels[] = [];
    expect(prometheusExpressionBuilder(filters)).toBe('');
  });

  describe('reported bug test cases', () => {
    it('should match alerts starting with foo using foo.*', () => {
      const filters: AdHocFilterWithLabels[] = [{ key: 'alertname', operator: '=~', value: 'foo.*' }];
      // This should produce a valid regex that matches anything starting with foo
      expect(prometheusExpressionBuilder(filters)).toBe('alertname=~"foo.*"');
    });

    it('should match exact alert with regex operator', () => {
      const filters: AdHocFilterWithLabels[] = [{ key: 'alertname', operator: '=~', value: 'fooalert' }];
      // This should work for exact matches too (regex matching literal string)
      expect(prometheusExpressionBuilder(filters)).toBe('alertname=~"fooalert"');
    });

    it('should handle foo as a prefix pattern', () => {
      const filters: AdHocFilterWithLabels[] = [{ key: 'alertname', operator: '=~', value: 'foo' }];
      // Just 'foo' as a regex should match anything containing 'foo'
      expect(prometheusExpressionBuilder(filters)).toBe('alertname=~"foo"');
    });
  });
});
