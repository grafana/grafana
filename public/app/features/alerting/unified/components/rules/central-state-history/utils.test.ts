import fixtureData from './__fixtures__/alert-state-history';
import { historyResultToDataFrame, toMatchersParam } from './utils';

describe('historyResultToDataFrame', () => {
  it('should decode', () => {
    expect(historyResultToDataFrame(fixtureData)).toMatchSnapshot();
  });

  it('should decode and filter example1', () => {
    expect(
      historyResultToDataFrame(fixtureData, {
        labels: "alertname: 'XSS attack vector'",
      })
    ).toMatchSnapshot();
  });
  it('should decode and filter example2', () => {
    expect(historyResultToDataFrame(fixtureData, { labels: 'region: EMEA' })).toMatchSnapshot();
  });
});

describe('toMatchersParam', () => {
  it('returns undefined for empty string', () => {
    expect(toMatchersParam('')).toBeUndefined();
  });

  it('returns undefined for whitespace-only string', () => {
    expect(toMatchersParam('   ')).toBeUndefined();
  });

  it('passes through already-wrapped selector unchanged', () => {
    expect(toMatchersParam('{severity="critical"}')).toBe('{severity="critical"}');
  });

  it('passes through selector with all operator types unchanged', () => {
    expect(toMatchersParam('{severity=~"crit.*",env!="dev",zone!~"us-.*"}')).toBe(
      '{severity=~"crit.*",env!="dev",zone!~"us-.*"}'
    );
  });

  it('wraps bare matchers in braces', () => {
    expect(toMatchersParam('severity="critical"')).toBe('{severity="critical"}');
  });

  it('wraps bare comma-separated matchers in braces', () => {
    expect(toMatchersParam('alertname=alert1, team="alerting"')).toBe('{alertname=alert1, team="alerting"}');
  });

  it('wraps mixed operator bare matchers in braces', () => {
    expect(toMatchersParam('severity=~"crit.*",env!="dev"')).toBe('{severity=~"crit.*",env!="dev"}');
  });
});
