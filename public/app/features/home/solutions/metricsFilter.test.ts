import { labelIssue, parseMetricsFilter, patternIssue, summarizeMetricsFilter } from './metricsFilter';

const stored = {
  datasourceUid: 'prom-uid',
  datasourceName: 'Prometheus',
  excludes: [{ label: 'instance', regex: 'cache-.*' }],
};

const INVALID_LABEL = 'Label names may only contain letters, digits and underscores';
const INVALID_PATTERN = 'Pattern is not a valid regular expression';

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

describe('summarizeMetricsFilter', () => {
  it('lists the exclusions', () => {
    expect(
      summarizeMetricsFilter({ ...stored, excludes: [...stored.excludes, { label: 'mountpoint', regex: '/scratch' }] })
    ).toBe('Excluding instance: cache-.*, mountpoint: /scratch');
  });
});

describe('labelIssue', () => {
  it('names a missing or malformed label name', () => {
    expect(labelIssue(' ')).toBe('Choose a label');
    expect(labelIssue('inst-ance')).toBe(INVALID_LABEL);
    expect(labelIssue(' instance ')).toBeNull();
  });
});

describe('patternIssue', () => {
  it('names a missing pattern', () => {
    expect(patternIssue(' ')).toBe('Enter a pattern');
  });

  it.each(['[', 'cache-(', '*cache', '(?=cache)', '(?<!gke-)cache', 'cache-\\1'])(
    'rejects a pattern Prometheus would refuse: %s',
    (regex) => {
      expect(patternIssue(regex)).toBe(INVALID_PATTERN);
    }
  );

  it.each(['.*-cache-.*', 'web-1:9100|web-2:9100', '/mnt/disks/ssd[0-9]+', '(?i)cache-.*', '10\\.0\\.0\\.1'])(
    'accepts a pattern Prometheus would run: %s',
    (regex) => {
      expect(patternIssue(regex)).toBeNull();
    }
  );
});
