import { labelIssue, parseMetricsFilter, patternIssue } from './metricsFilter';

const stored = {
  datasourceUid: 'prom-uid',
  datasourceName: 'Prometheus',
  excludes: [{ label: 'instance', regex: 'cache-.*' }],
};

describe('parseMetricsFilter', () => {
  it('trims the rows and reads an empty list as unscoped', () => {
    expect(
      parseMetricsFilter(JSON.stringify({ ...stored, excludes: [{ label: ' instance ', regex: ' cache-.* ' }] }))
    ).toEqual(stored);
    expect(parseMetricsFilter(JSON.stringify({ ...stored, excludes: [] }))).toBeNull();
  });

  it.each([
    ['a half-filled row', { label: 'job', regex: '' }],
    ['a malformed label name', { label: 'inst-ance', regex: 'x' }],
    ['a pattern Prometheus would refuse', { label: 'instance', regex: '[' }],
  ])('refuses a stored filter with %s', (_case, row) => {
    expect(parseMetricsFilter(JSON.stringify({ ...stored, excludes: [row] }))).toBeNull();
  });
});

describe('field rules', () => {
  it('name what is missing or malformed', () => {
    expect(labelIssue(' ')).toBe('Choose a label');
    expect(labelIssue('inst-ance')).toBe('Label names may only contain letters, digits and underscores');
    expect(labelIssue(' instance ')).toBeNull();
    expect(patternIssue(' ')).toBe('Enter a pattern');
    expect(patternIssue('cache-(')).toBe('Pattern is not a valid regular expression');
    // RE2's inline flag group is not JS syntax; the shared check translates it before compiling.
    expect(patternIssue('(?i)cache-.*')).toBeNull();
  });
});
