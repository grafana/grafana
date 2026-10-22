import { matchPluginId, store } from '@grafana/data';
import { type DataQuery } from '@grafana/schema';

import { appendToExpr, appendToQueryExpr, getPrometheusEditorMode, isPrometheusType } from './prometheus';

describe('isPrometheusType', () => {
  it.each(['prometheus', 'grafana-amazonprometheus-datasource', 'grafana-azureprometheus-datasource'])(
    'treats %s as Prometheus',
    (type) => {
      expect(isPrometheusType(type)).toBe(true);
    }
  );

  it.each(['loki', 'elasticsearch', 'grafana-testdata-datasource', 'prometheus-something-else'])(
    'treats %s as not Prometheus',
    (type) => {
      expect(isPrometheusType(type)).toBe(false);
    }
  );

  it.each([undefined, null, ''])('returns false for %p', (type) => {
    expect(isPrometheusType(type)).toBe(false);
  });
});

// Explore checks the pane datasource with `matchPluginId` and full plugin meta, and each
// Mixed query with `isPrometheusType` and a bare type. These pin that the two agree.
describe('agreement with matchPluginId', () => {
  it.each(['prometheus', 'grafana-amazonprometheus-datasource', 'loki'])(
    'gives the same answer for %s as full plugin meta does',
    (id) => {
      expect(isPrometheusType(id)).toBe(matchPluginId('prometheus', { id }));
    }
  );

  it('ignores aliasIDs, which is why a bare type id is a safe substitute for plugin meta', () => {
    expect(matchPluginId('prometheus', { id: 'some-datasource', aliasIDs: ['prometheus'] })).toBe(false);
  });
});

describe('getPrometheusEditorMode', () => {
  const STORAGE_KEY = 'PrometheusQueryEditorModeDefault';
  const promQuery = (fields: { expr?: string; editorMode?: string }): DataQuery => ({ refId: 'A', ...fields });

  afterEach(() => {
    store.delete(STORAGE_KEY);
  });

  it.each(['code', 'builder'])('follows an explicit %s editorMode over everything else', (editorMode) => {
    store.set(STORAGE_KEY, editorMode === 'code' ? 'builder' : 'code');

    expect(getPrometheusEditorMode(promQuery({ expr: 'up', editorMode }))).toBe(editorMode);
  });

  it('treats a query with an expression and no mode as Code', () => {
    store.set(STORAGE_KEY, 'builder');

    expect(getPrometheusEditorMode(promQuery({ expr: 'up' }))).toBe('code');
  });

  it.each(['code', 'builder'])('falls back to the %s mode the user last picked for an empty query', (stored) => {
    store.set(STORAGE_KEY, stored);

    expect(getPrometheusEditorMode(promQuery({ expr: '' }))).toBe(stored);
  });

  it('leaves an empty query with no stored pick to the datasource default', () => {
    expect(getPrometheusEditorMode(promQuery({}))).toBeUndefined();
  });
});

describe('appendToExpr', () => {
  it.each([
    [undefined, 'up', 'up'],
    ['', 'up', 'up'],
    ['sum(rate(up[5m]))', 'by', 'sum(rate(up[5m])) by'],
    ['up ', 'or', 'up or'],
    ['up{', 'le', 'up{le'],
    ['up{job="api"', 'le', 'up{job="api" le'],
    ["up{job='api'", 'le', "up{job='api' le"],
    ['up{job="api",', 'le', 'up{job="api",le'],
    ['sum(', 'up', 'sum(up'],
  ])('appends the name to %p: %s gives %s', (expr, text, expected) => {
    expect(appendToExpr(expr, text, 'name')).toBe(expected);
  });

  it.each([
    ['up{le="', '0.5', 'up{le="0.5'],
    ['up{job="api",le="', '0.5', 'up{job="api",le="0.5'],
    ["up{job='", 'api', "up{job='api"],
    ['up{job=`', 'api', 'up{job=`api'],
    ['up{path="', 'C:\\Windows', 'up{path="C:\\\\Windows'],
    ['up{v="', 'a"b', 'up{v="a\\"b'],
    ["up{v='", "it's", "up{v='it\\'s"],
    ['up{v="', "it's", 'up{v="it\'s'],
    [`up{a='x"y',b="`, 'web-1', `up{a='x"y',b="web-1`],
    ['up{a="x\\"y",b="', 'web-1', 'up{a="x\\"y",b="web-1'],
    ['up{v=`', 'a`b', 'up{v=`'],
    ['up{v="', 'a\nb', 'up{v="a\\nb'],
    ["up # don't\n{job=", 'api', 'up # don\'t\n{job="api"'],
    ['up # "\n{job="', 'a"b', 'up # "\n{job="a\\"b'],
    ['up{job=', 'api', 'up{job="api"'],
    ['up{job!=', 'api', 'up{job!="api"'],
    ['up{job=~', 'api', 'up{job=~"api"'],
    ['up{job!~ ', 'api', 'up{job!~ "api"'],
    ['up{v=', 'a"b', 'up{v="a\\"b"'],
    ['up{ip=~', '10.0.0.1', 'up{ip=~"10\\\\.0\\\\.0\\\\.1"'],
    ['up{ip=~"', '10.0.0.1', 'up{ip=~"10\\\\.0\\\\.0\\\\.1'],
    ['up{ip=~`', '10.0.0.1', 'up{ip=~`10\\.0\\.0\\.1'],
    ['up{ip="', '10.0.0.1', 'up{ip="10.0.0.1'],
    ['up >=', '1', 'up >=1'],
  ])('appends the value to %p: %s gives %s', (expr, text, expected) => {
    expect(appendToExpr(expr, text, 'value')).toBe(expected);
  });
});

describe('appendToQueryExpr', () => {
  it('changes only the query with the given refId', () => {
    const queryA = { refId: 'A', expr: 'up' };
    const queryB = { refId: 'B', expr: 'rate(' };

    const [nextA, nextB] = appendToQueryExpr([queryA, queryB], 'B', 'http_requests_total', 'name');

    expect(nextA).toBe(queryA);
    expect(nextB).toEqual({ refId: 'B', expr: 'rate(http_requests_total' });
  });

  it('gives a query with no expression one', () => {
    expect(appendToQueryExpr([{ refId: 'A' }], 'A', 'up', 'name')).toEqual([{ refId: 'A', expr: 'up' }]);
  });

  it('quotes a value added after a matcher', () => {
    const query = { refId: 'A', expr: 'up{job=' };

    expect(appendToQueryExpr([query], 'A', 'api', 'value')).toEqual([{ refId: 'A', expr: 'up{job="api"' }]);
  });
});
