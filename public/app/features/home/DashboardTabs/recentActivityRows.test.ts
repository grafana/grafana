import { type NavModelItem } from '@grafana/data';
import { type ExplorePaneDescription } from 'app/features/explore/utils/describeExplorePanes';
import { type DashboardQueryResult, type LocationInfo } from 'app/features/search/service/types';

import { toRow } from './recentActivityRows';
import { type RecentActivityItem } from './useRecentActivity';

const dashboard = { uid: 'abc', name: 'Service overview', location: 'folder-1' } as DashboardQueryResult;
const foldersByUid: Record<string, LocationInfo> = { 'folder-1': { kind: 'folder', name: 'Ops', url: '/f' } };

function dashboardRow(search: string, folders = foldersByUid) {
  const item: RecentActivityItem = { kind: 'dashboard', uid: 'abc', pathname: '/d/abc', search, dashboard };
  return toRow(item, [], folders);
}

describe('toRow', () => {
  describe('dashboard', () => {
    it('shows the folder, the time range and the variables; nothing else from the URL', () => {
      expect(dashboardRow('?orgId=1&from=now-90d&to=now&timezone=browser&var-Plugin=finnhub&viewPanel=3')).toEqual({
        title: 'Service overview',
        subtitle: 'Ops · Last 90 days · Plugin=finnhub',
      });
    });

    it('describes an absolute range in the URL timezone', () => {
      // Parsing the forms a URL carries is parseUrlTime's; this proves both ends and the zone reach the range.
      expect(dashboardRow('?from=1717000000000&to=1717003600000&timezone=utc', {}).subtitle).toBe(
        '2024-05-29 16:26:40 to 2024-05-29 17:26:40'
      );
      expect(
        dashboardRow('?from=2024-05-29T16:26:40.000Z&to=2024-05-29T17:26:40.000Z&timezone=Europe%2FBerlin', {}).subtitle
      ).toBe('2024-05-29 18:26:40 to 2024-05-29 19:26:40');
    });

    it('joins multi-value variables', () => {
      expect(dashboardRow('var-host=a&var-host=b', {}).subtitle).toBe('host=a, b');
    });

    it('has no subtitle when there is nothing to show', () => {
      expect(dashboardRow('?orgId=1&from=now-1h', {}).subtitle).toBeUndefined();
    });
  });

  describe('explore', () => {
    const explore = (panes: ExplorePaneDescription[]) =>
      toRow({ kind: 'explore', session: 'abc', pathname: '/explore', search: '', panes }, [], {});

    it('titles the row with the datasource and lists the queries under it, panes side by side', () => {
      expect(
        explore([
          { datasource: 'Ops Logs', queries: ['up', 'down'] },
          { datasource: 'unknown-uid', queries: ['select 1'] },
        ])
      ).toEqual({ title: 'Ops Logs | unknown-uid', subtitle: 'up; down | select 1' });
    });

    it.each([
      [
        [
          { datasource: 'Ops Logs', queries: ['up'] },
          { datasource: 'Prom', queries: [] },
        ],
        'Ops Logs | Prom',
        'up | —',
      ],
      [
        [
          { datasource: 'Ops Logs', queries: [] },
          { datasource: 'Prom', queries: ['up'] },
        ],
        'Ops Logs | Prom',
        '— | up',
      ],
      [
        [
          { datasource: undefined, queries: ['a'] },
          { datasource: 'Prom', queries: ['b'] },
        ],
        '— | Prom',
        'a | b',
      ],
    ])('keeps each pane in its slot when only some have text or a name: %j', (panes, title, subtitle) => {
      expect(explore(panes)).toEqual({ title, subtitle });
    });

    it('falls back to "Explore" without a datasource and to no subtitle without query text', () => {
      expect(explore([{ datasource: 'Ops Logs', queries: [] }])).toEqual({ title: 'Ops Logs', subtitle: undefined });
      expect(explore([{ datasource: undefined, queries: ['up'] }])).toEqual({ title: 'Explore', subtitle: 'up' });
      expect(explore([])).toEqual({ title: 'Explore', subtitle: undefined });
    });
  });

  describe('page', () => {
    const page = (title: string | undefined, search = '') =>
      toRow(
        { kind: 'page', pathname: '/a/grafana-assistant-app/pages/grafana-org-tenure-cb1e1e23764b', search, title },
        [],
        {}
      );

    it('titles the row with the title the page set and shows its state, never the path', () => {
      expect(page('Grafana org tenure', '?orgId=1&tab=sources')).toEqual({
        title: 'Grafana org tenure',
        subtitle: 'tab=sources',
      });
    });

    it('falls back to the slug from the path when the page never set a title', () => {
      expect(page(undefined)).toEqual({ title: 'grafana-org-tenure-cb1e1e23764b', subtitle: undefined });
    });
  });

  describe('alerting and app pages', () => {
    const navTree: NavModelItem[] = [
      { text: 'Alerting', url: '/alerting', children: [{ text: 'Alert rules', url: '/alerting/list' }] },
    ];

    it('uses the nav label for a page in the nav tree and shows every filter but the plumbing params', () => {
      const item: RecentActivityItem = {
        kind: 'alerting',
        pathname: '/alerting/list',
        search: '?orgId=1&search=state:firing&view=list&returnTo=%2Falerting%2Flist',
        title: 'Alert rules',
      };
      expect(toRow(item, navTree, {})).toEqual({ title: 'Alert rules', subtitle: 'search=state:firing · view=list' });
    });

    it('titles a deep link with the title the page set and shows its path, minus the area prefix', () => {
      const item: RecentActivityItem = {
        kind: 'app',
        pathname: '/a/grafana-irm-app/incidents/5987',
        search: '?from=now-6h&to=now&var-cluster=prod&tab=timeline',
        title: 'Incidents',
      };
      expect(toRow(item, navTree, {})).toEqual({
        title: 'Incidents',
        subtitle: 'grafana-irm-app/incidents/5987 · Last 6 hours · cluster=prod · tab=timeline',
      });
    });

    it('falls back to the path as the title, once, when the page never set one', () => {
      const item: RecentActivityItem = { kind: 'alerting', pathname: '/alerting/grafana/abc/view', search: '' };
      expect(toRow(item, navTree, {})).toEqual({ title: '/alerting/grafana/abc/view', subtitle: undefined });
    });
  });
});
