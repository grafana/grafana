import { type ResourceStats } from 'app/api/clients/provisioning/v0alpha1';

import {
  aggregateDashboardTotals,
  aggregateFolderCounts,
  aggregatePlaylistTotals,
  computeBreakdowns,
  percent,
} from './stats';

// 100 dashboards total, 40 managed by Git Sync, 10 by Terraform => 50 managed,
// 50 unmanaged. 8 folders total, 6 managed (4 git sync + 2 terraform). 20
// playlists total, 5 managed by Git Sync => 15 unmanaged.
const stats: ResourceStats = {
  instance: [
    { group: 'dashboard.grafana.app', resource: 'dashboards', count: 100 },
    { group: 'folder.grafana.app', resource: 'folders', count: 8 },
    { group: 'playlist.grafana.app', resource: 'playlists', count: 20 },
  ],
  managed: [
    {
      kind: 'repo',
      stats: [
        { group: 'dashboard.grafana.app', resource: 'dashboards', count: 40 },
        { group: 'folder.grafana.app', resource: 'folders', count: 4 },
        { group: 'playlist.grafana.app', resource: 'playlists', count: 5 },
      ],
    },
    {
      kind: 'terraform',
      stats: [
        { group: 'dashboard.grafana.app', resource: 'dashboards', count: 10 },
        { group: 'folder.grafana.app', resource: 'folders', count: 2 },
      ],
    },
  ],
};

describe('computeBreakdowns', () => {
  it('always emits a folder, dashboard and playlist row even with no data', () => {
    const breakdowns = computeBreakdowns(undefined);
    const groups = breakdowns.map((b) => b.group).sort();
    expect(groups).toEqual(['dashboard.grafana.app', 'folder.grafana.app', 'playlist.grafana.app']);
    breakdowns.forEach((b) => {
      expect(b.total).toBe(0);
      expect(b.gitSyncCount).toBe(0);
      expect(b.otherManagedCount).toBe(0);
      expect(b.unmanagedCount).toBe(0);
    });
  });

  it('splits counts into git sync, other managed, and unmanaged', () => {
    const breakdowns = computeBreakdowns(stats);
    const dashboards = breakdowns.find((b) => b.group === 'dashboard.grafana.app')!;
    expect(dashboards.total).toBe(100);
    expect(dashboards.gitSyncCount).toBe(40);
    expect(dashboards.otherManagedCount).toBe(10);
    expect(dashboards.unmanagedCount).toBe(50);

    const folders = breakdowns.find((b) => b.group === 'folder.grafana.app')!;
    expect(folders.total).toBe(8);
    expect(folders.gitSyncCount).toBe(4);
    expect(folders.otherManagedCount).toBe(2);
    expect(folders.unmanagedCount).toBe(2);
  });

  it('ignores non-dashboard resources in the dashboard group', () => {
    const breakdowns = computeBreakdowns({
      instance: [
        { group: 'dashboard.grafana.app', resource: 'dashboards', count: 10 },
        // Same group, different resource — must not count toward dashboards.
        { group: 'dashboard.grafana.app', resource: 'variables', count: 7 },
        { group: 'dashboard.grafana.app', resource: 'librarypanels', count: 3 },
      ],
      managed: [
        {
          kind: 'repo',
          stats: [
            { group: 'dashboard.grafana.app', resource: 'dashboards', count: 4 },
            { group: 'dashboard.grafana.app', resource: 'variables', count: 2 },
          ],
        },
      ],
    });
    const dashboards = breakdowns.find((b) => b.group === 'dashboard.grafana.app')!;
    expect(dashboards.total).toBe(10);
    expect(dashboards.gitSyncCount).toBe(4);
    expect(dashboards.unmanagedCount).toBe(6);
  });

  it('folds the legacy `folders` group into folder.grafana.app', () => {
    const breakdowns = computeBreakdowns({
      instance: [{ group: 'folders', resource: 'folders', count: 5 }],
      managed: [{ kind: 'repo', stats: [{ group: 'folders', resource: 'folders', count: 3 }] }],
    });
    const folders = breakdowns.find((b) => b.group === 'folder.grafana.app')!;
    expect(folders.total).toBe(5);
    expect(folders.gitSyncCount).toBe(3);
    expect(folders.unmanagedCount).toBe(2);
  });
});

describe('aggregateDashboardTotals', () => {
  it('reports dashboard-only totals', () => {
    const totals = aggregateDashboardTotals(computeBreakdowns(stats));
    expect(totals).toEqual({ instanceTotal: 100, managed: 50 });
  });
});

describe('aggregatePlaylistTotals', () => {
  it('reports playlist-only totals', () => {
    const totals = aggregatePlaylistTotals(computeBreakdowns(stats));
    expect(totals).toEqual({ instanceTotal: 20, managed: 5 });
  });

  it('ignores non-playlist resources in the playlist group', () => {
    const breakdowns = computeBreakdowns({
      instance: [
        { group: 'playlist.grafana.app', resource: 'playlists', count: 12 },
        // Same group, different resource — must not count toward playlists.
        { group: 'playlist.grafana.app', resource: 'somethingelse', count: 4 },
      ],
    });
    expect(aggregatePlaylistTotals(breakdowns)).toEqual({ instanceTotal: 12, managed: 0 });
  });
});

describe('aggregateFolderCounts', () => {
  it('reports managed and total folder counts', () => {
    const folderCounts = aggregateFolderCounts(computeBreakdowns(stats));
    expect(folderCounts).toEqual({ managed: 6, total: 8 });
  });
});

describe('percent', () => {
  it('floors the percentage so a partial migration never reads as complete', () => {
    expect(percent(50, 100)).toBe('50%');
    expect(percent(1, 3)).toBe('33%');
    expect(percent(999, 1000)).toBe('99%');
  });

  it('returns 0% when the total is zero', () => {
    expect(percent(0, 0)).toBe('0%');
  });
});
