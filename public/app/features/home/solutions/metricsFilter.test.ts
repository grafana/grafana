import { labelIssue, parseMetricsFilter, patternIssue } from './metricsFilter';

const stored = {
  datasourceUid: 'prom-uid',
  datasourceName: 'Prometheus',
  excludes: [{ label: 'instance', regex: 'cache-.*' }],
};

describe('parseMetricsFilter', () => {
  it('drops half-filled rows, trims, and reads nothing left as unscoped', () => {
    const rows = [
      { label: ' instance ', regex: ' cache-.* ' },
      { label: 'job', regex: '' },
      { label: '', regex: 'x' },
    ];

    expect(parseMetricsFilter(JSON.stringify({ ...stored, excludes: rows }))).toEqual(stored);
    expect(parseMetricsFilter(JSON.stringify({ ...stored, excludes: rows.slice(1) }))).toBeNull();
  });

  it('refuses a filter whose label name or pattern would break the query', () => {
    expect(
      parseMetricsFilter(JSON.stringify({ ...stored, excludes: [{ label: 'inst-ance', regex: 'x' }] }))
    ).toBeNull();
    expect(parseMetricsFilter(JSON.stringify({ ...stored, excludes: [{ label: 'instance', regex: '[' }] }))).toBeNull();
  });
});

describe('field rules', () => {
  it('name what is missing or malformed', () => {
    expect(labelIssue(' ')).toBe('Choose a label');
    expect(labelIssue('inst-ance')).toBe('Label names may only contain letters, digits and underscores');
    expect(labelIssue(' instance ')).toBeNull();
    expect(patternIssue(' ')).toBe('Enter a pattern');
  });

  // One row per way a pattern can fail: the engine refuses it, or it uses a construct RE2 lacks.
  it.each(['cache-(', '(?=cache)', 'cache-\\1'])('reject a pattern Prometheus would refuse: %s', (regex) => {
    expect(patternIssue(regex)).toBe('Pattern is not a valid regular expression');
  });

  // RE2's inline flag group, and a backslash the backreference guard must not mistake.
  it.each(['(?i)cache-.*', '10\\.0\\.0\\.1'])('accept a pattern Prometheus would run: %s', (regex) => {
    expect(patternIssue(regex)).toBeNull();
  });
});
