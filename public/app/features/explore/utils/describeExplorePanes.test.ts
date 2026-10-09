import { makeDataSourceSettings } from 'test/helpers/makeDataSourceSettings';

import { setDataSourceInstanceSettings } from '@grafana/runtime/internal';

import { describeExplorePanes } from './describeExplorePanes';

const explorePanes = (panes: unknown) => `?schemaVersion=1&panes=${encodeURIComponent(JSON.stringify(panes))}`;

beforeEach(() => {
  setDataSourceInstanceSettings({
    loki: makeDataSourceSettings('loki-uid', 'Ops Logs', 'loki', { isDefault: true }),
    prom: makeDataSourceSettings('prom-uid', 'Prom', 'prometheus'),
    mixed: makeDataSourceSettings('mixed-uid', '-- Mixed --', 'mixed', { mixed: true }),
  });
});

describe('describeExplorePanes', () => {
  it('names the datasource and reads the query text of every pane', async () => {
    const search = explorePanes({
      abc: {
        datasource: 'loki-uid',
        queries: [
          { refId: 'A', expr: '{service_name="api"}' },
          { refId: 'B', expr: 'up' },
        ],
        range: { from: 'now-1h', to: 'now' },
      },
      def: { datasource: 'unknown-uid', queries: [{ rawSql: 'select 1' }], range: { from: 'now-1h', to: 'now' } },
    });

    expect(await describeExplorePanes(search)).toEqual([
      { datasource: 'Ops Logs', queries: ['{service_name="api"}', 'up'] },
      // A datasource that no longer resolves keeps its ref so the row still says something.
      { datasource: 'unknown-uid', queries: ['select 1'] },
    ]);
  });

  it('names each query its own datasource in a mixed pane', async () => {
    const search = explorePanes({
      abc: {
        datasource: 'mixed-uid',
        queries: [
          { refId: 'A', expr: 'up', datasource: { uid: 'prom-uid', type: 'prometheus' } },
          { refId: 'B', expr: '{a="b"}', datasource: 'loki-uid' },
          { refId: 'C', expr: 'rate', datasource: { uid: 'gone' } },
          { refId: 'D', expr: 'x' },
          { refId: 'E', expr: '', datasource: 'loki-uid' },
        ],
        range: { from: 'now-1h', to: 'now' },
      },
    });

    expect(await describeExplorePanes(search)).toEqual([
      { datasource: undefined, queries: ['Prom: up', 'Ops Logs: {a="b"}', 'gone: rate', 'x'] },
    ]);
  });

  it('migrates the v0 array form', async () => {
    expect(
      await describeExplorePanes('?left=%5B%22now-1h%22,%22now%22,%22loki-uid%22,%7B%22expr%22:%22up%22%7D%5D')
    ).toEqual([{ datasource: 'Ops Logs', queries: ['up'] }]);
  });

  it('skips queries without text, including the null elements the migrator keeps', async () => {
    const search = explorePanes({
      abc: {
        datasource: 'loki-uid',
        queries: [null, { refId: 'A' }, { expr: '  ' }],
        range: { from: 'now-1h', to: 'now' },
      },
    });

    expect(await describeExplorePanes(search)).toEqual([{ datasource: 'Ops Logs', queries: [] }]);
  });

  it.each(['?schemaVersion=1&panes=%7Bnot-json', '?schemaVersion=2&panes=%7B%7D', '', '?schemaVersion=1'])(
    'returns no panes for %s',
    async (search) => {
      expect(await describeExplorePanes(search)).toEqual([]);
    }
  );
});
