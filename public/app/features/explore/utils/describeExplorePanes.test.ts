import { makeDataSourceSettings } from 'test/helpers/makeDataSourceSettings';

import { setDataSourceInstanceSettings } from '@grafana/runtime/internal';

import { describeExplorePanes, type ExploreDataSources, getExploreDataSources } from './describeExplorePanes';

const explorePanes = (panes: unknown) => `?schemaVersion=1&panes=${encodeURIComponent(JSON.stringify(panes))}`;

const loki = { name: 'Ops Logs', mixed: false };
const prom = { name: 'Prom', mixed: false };
const mixed = { name: '-- Mixed --', mixed: true };
const dataSources: ExploreDataSources = new Map([
  ['loki-uid', loki],
  ['Ops Logs', loki],
  ['prom-uid', prom],
  ['mixed-uid', mixed],
]);

describe('getExploreDataSources', () => {
  it('resolves by uid and by name and knows which datasource is mixed', async () => {
    setDataSourceInstanceSettings({
      loki: makeDataSourceSettings('loki-uid', 'Ops Logs', 'loki', { isDefault: true }),
      mixed: makeDataSourceSettings('mixed-uid', '-- Mixed --', 'mixed', { mixed: true }),
    });

    const result = await getExploreDataSources();

    expect(result.get('loki-uid')).toEqual({ name: 'Ops Logs', mixed: false });
    expect(result.get('Ops Logs')).toEqual({ name: 'Ops Logs', mixed: false });
    expect(result.get('mixed-uid')).toEqual({ name: '-- Mixed --', mixed: true });
  });
});

describe('describeExplorePanes', () => {
  it('names the datasource and reads the query text of every pane', () => {
    const search = explorePanes({
      abc: {
        datasource: 'loki-uid',
        queries: [
          { refId: 'A', expr: '{service_name="api"}' },
          { refId: 'B', expr: 'up' },
        ],
        range: { from: 'now-1h', to: 'now' },
      },
      def: { datasource: 'unknown-uid', queries: [{ expr: 'down' }], range: { from: 'now-1h', to: 'now' } },
    });

    expect(describeExplorePanes(search, dataSources)).toEqual([
      { datasource: 'Ops Logs', queries: ['{service_name="api"}', 'up'] },
      // A datasource that no longer resolves keeps its ref so the row still says something.
      { datasource: 'unknown-uid', queries: ['down'] },
    ]);
  });

  it('names each query its own datasource in a mixed pane', () => {
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

    expect(describeExplorePanes(search, dataSources)).toEqual([
      { datasource: '-- Mixed --', queries: ['Prom: up', 'Ops Logs: {a="b"}', 'gone: rate', 'x'] },
    ]);
  });

  it('migrates the v0 array form', () => {
    expect(
      describeExplorePanes('?left=%5B%22now-1h%22,%22now%22,%22loki-uid%22,%7B%22expr%22:%22up%22%7D%5D', dataSources)
    ).toEqual([{ datasource: 'Ops Logs', queries: ['up'] }]);
  });

  it('skips queries without text, including the null elements the migrator keeps', () => {
    const search = explorePanes({
      abc: { datasource: 'loki-uid', queries: [null, { refId: 'A' }], range: { from: 'now-1h', to: 'now' } },
    });

    expect(describeExplorePanes(search, dataSources)).toEqual([{ datasource: 'Ops Logs', queries: [] }]);
  });

  it.each(['?schemaVersion=1&panes=%7Bnot-json', '?schemaVersion=2&panes=%7B%7D', '', '?schemaVersion=1'])(
    'returns no panes for %s',
    (search) => {
      expect(describeExplorePanes(search, dataSources)).toEqual([]);
    }
  );
});
