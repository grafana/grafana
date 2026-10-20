import { matchPluginId, store } from '@grafana/data';
import { type DataQuery } from '@grafana/schema';

import {
  appendToExpr,
  appendToQueryExpr,
  getPrometheusEditorMode,
  insertAtSelection,
  isPrometheusType,
} from './prometheus';

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
    ['up{le="', '0.5', 'up{le="0.5'],
    ['up{job="api"', 'le', 'up{job="api" le'],
    ['up{job="api",le="', '0.5', 'up{job="api",le="0.5'],
    ["up{job='", 'api', "up{job='api"],
    ["up{job='api'", 'le', "up{job='api' le"],
    ['up{job=`', 'api', 'up{job=`api'],
    ['up{job=~', 'api', 'up{job=~api'],
    ['up{job="api",', 'le', 'up{job="api",le'],
    ['sum(', 'up', 'sum(up'],
    ['up{job="a\\"', 'b', 'up{job="a\\"b'],
  ])('appends to %p: %s gives %s', (expr, text, expected) => {
    expect(appendToExpr(expr, text)).toBe(expected);
  });
});

describe('insertAtSelection', () => {
  // `|` marks the cursor and `«…»` the selection; neither is part of the expression.
  function insert(marked: string, text: string) {
    const from = marked.search(/[|«]/);
    const selected = marked.match(/«(.*?)»/)?.[1] ?? '';
    const value = marked.replace('|', '').replace(/«(.*?)»/, '$1');
    return insertAtSelection(value, from, from + selected.length, text);
  }

  it.each([
    { marked: 'rate(|[5m])', text: 'up', expected: 'rate(up[5m])' },
    { marked: '|(up)', text: 'sum', expected: 'sum(up)' },
    { marked: 'sum(rate(up[5m])) | (job)', text: 'by', expected: 'sum(rate(up[5m])) by (job)' },
    { marked: 'up|or vector(0)', text: 'and', expected: 'up and or vector(0)' },
    { marked: 'up{|}', text: 'job', expected: 'up{job}' },
    { marked: 'up{|="api"}', text: 'job', expected: 'up{job="api"}' },
    { marked: 'up{job="api",|}', text: 'le', expected: 'up{job="api",le}' },
    { marked: 'up{job="api"|}', text: 'le', expected: 'up{job="api" le}' },
    { marked: 'up{job="|"}', text: 'api', expected: 'up{job="api"}' },
    { marked: 'up{job="ap|"}', text: 'i 2', expected: 'up{job="api 2"}' },
    // A backslash does not escape in a backtick string, so the string closes and the cursor is outside it.
    { marked: 'up{job=`a\\`}|', text: 'or', expected: 'up{job=`a\\`} or' },
  ])('inserts $text at the cursor in $marked', ({ marked, text, expected }) => {
    expect(insert(marked, text).value).toBe(expected);
  });

  it.each([
    { marked: 'rate(«up»[5m])', text: 'http_requests_total', expected: 'rate(http_requests_total[5m])' },
    { marked: 'sum(«rate(up[5m])»)', text: 'up', expected: 'sum(up)' },
    { marked: 'up{job="«api»"}', text: 'web', expected: 'up{job="web"}' },
    { marked: '«up»', text: 'node_load1', expected: 'node_load1' },
  ])('replaces the selection in $marked with $text', ({ marked, text, expected }) => {
    expect(insert(marked, text).value).toBe(expected);
  });

  it('returns the text that replaced the selection, spaces included', () => {
    expect(insert('sum(up) |(job)', 'by')).toEqual({ value: 'sum(up) by(job)', text: 'by' });
    expect(insert('up|or vector(0)', 'and')).toEqual({ value: 'up and or vector(0)', text: ' and ' });
  });
});

describe('appendToQueryExpr', () => {
  it('changes only the query with the given refId', () => {
    const queryA = { refId: 'A', expr: 'up' };
    const queryB = { refId: 'B', expr: 'rate(' };

    const [nextA, nextB] = appendToQueryExpr([queryA, queryB], 'B', 'http_requests_total');

    expect(nextA).toBe(queryA);
    expect(nextB).toEqual({ refId: 'B', expr: 'rate(http_requests_total' });
  });

  it('gives a query with no expression one', () => {
    expect(appendToQueryExpr([{ refId: 'A' }], 'A', 'up')).toEqual([{ refId: 'A', expr: 'up' }]);
  });
});
