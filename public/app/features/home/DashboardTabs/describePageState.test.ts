import { type NavModelItem } from '@grafana/data';

import { describeAppState, describeDashboardState, describeExploreState, getNavTitle } from './describePageState';

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
  it('joins datasource and queries within a pane and panes with a bar', () => {
    expect(
      describeExploreState([
        { datasource: 'Ops Logs', queries: ['up', 'down'] },
        { datasource: 'unknown-uid', queries: ['select 1'] },
      ])
    ).toBe('Ops Logs · up; down | unknown-uid · select 1');
  });

  it('drops the separator when a pane has no query text or no datasource', () => {
    expect(describeExploreState([{ datasource: 'Ops Logs', queries: [] }])).toBe('Ops Logs');
    expect(describeExploreState([{ datasource: undefined, queries: ['up'] }])).toBe('up');
  });

  it('returns an empty string without panes', () => {
    expect(describeExploreState([])).toBe('');
  });
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
