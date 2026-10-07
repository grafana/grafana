import { type NavModelItem } from '@grafana/data';

import { describeAppState, describeDashboardState, describeExploreState, getNavTitle } from './describePageState';

jest.mock('@grafana/runtime/unstable', () => ({
  ...jest.requireActual('@grafana/runtime/unstable'),
  getDataSourceInstanceSettings: async (ref: string) => (ref === 'loki-uid' ? { name: 'Ops Logs' } : undefined),
}));

const explorePanes = (panes: unknown) => `?schemaVersion=1&panes=${encodeURIComponent(JSON.stringify(panes))}`;

describe('describeDashboardState', () => {
  it('shows the time range and variables only', () => {
    expect(describeDashboardState('?orgId=1&from=now-90d&to=now&timezone=browser&var-Plugin=finnhub')).toBe(
      'Last 90 days · Plugin=finnhub'
    );
  });

  it('formats absolute ranges in the URL timezone', () => {
    expect(describeDashboardState('?from=1717000000000&to=1717003600000&timezone=utc')).toBe(
      '2024-05-29 16:26:40 to 2024-05-29 17:26:40'
    );
    expect(describeDashboardState('?from=1717000000000&to=1717003600000&timezone=Europe%2FBerlin')).toBe(
      '2024-05-29 18:26:40 to 2024-05-29 19:26:40'
    );
  });

  it('joins multi-value variables', () => {
    expect(describeDashboardState('var-host=a&var-host=b&viewPanel=3')).toBe('host=a, b');
  });

  it('returns an empty string when there is nothing to show', () => {
    expect(describeDashboardState('?orgId=1&from=now-1h')).toBe('');
  });
});

describe('describeAppState', () => {
  it('shows every filter except the hidden plumbing params', () => {
    expect(describeAppState('?orgId=1&search=state:firing&view=list&returnTo=%2Falerting%2Flist')).toBe(
      'search=state:firing · view=list'
    );
  });

  it('puts the time range and variables before the other filters', () => {
    expect(describeAppState('?from=now-6h&to=now&var-cluster=prod&tab=pods')).toBe(
      'Last 6 hours · cluster=prod · tab=pods'
    );
  });
});

describe('describeExploreState', () => {
  it('shows the datasource name and query text per pane', async () => {
    const search = explorePanes({
      abc: {
        datasource: 'loki-uid',
        queries: [{ refId: 'A', expr: '{service_name="api"}' }],
        range: { from: 'now-1h', to: 'now' },
      },
    });
    expect(await describeExploreState(search)).toBe('Ops Logs · {service_name="api"}');
  });

  it('separates panes and queries', async () => {
    const search = explorePanes({
      abc: {
        datasource: 'loki-uid',
        queries: [{ expr: 'up' }, { expr: 'down' }],
        range: { from: 'now-1h', to: 'now' },
      },
      def: { datasource: 'unknown-uid', queries: [{ rawSql: 'select 1' }], range: { from: 'now-1h', to: 'now' } },
    });
    expect(await describeExploreState(search)).toBe('Ops Logs · up; down | unknown-uid · select 1');
  });

  it('migrates the v0 array form', async () => {
    expect(
      await describeExploreState('?left=%5B%22now-1h%22,%22now%22,%22loki-uid%22,%7B%22expr%22:%22up%22%7D%5D')
    ).toBe('Ops Logs · up');
  });

  it('skips null query elements', async () => {
    const search = explorePanes({
      abc: { datasource: 'loki-uid', queries: [null], range: { from: 'now-1h', to: 'now' } },
    });
    expect(await describeExploreState(search)).toBe('Ops Logs');
  });

  it.each(['?schemaVersion=1&panes=%7Bnot-json', '?schemaVersion=2&panes=%7B%7D', '', '?schemaVersion=1'])(
    'returns an empty string for %s',
    async (search) => {
      expect(await describeExploreState(search)).toBe('');
    }
  );
});

describe('getNavTitle', () => {
  const tree: NavModelItem[] = [
    { text: 'Alerting', url: '/alerting', children: [{ text: 'Alert rules', url: '/alerting/list' }] },
  ];

  it('returns the nav label for an exact url match only', () => {
    expect(getNavTitle(tree, '/alerting/list')).toBe('Alert rules');
    expect(getNavTitle(tree, '/alerting/list/abc')).toBeUndefined();
  });
});
