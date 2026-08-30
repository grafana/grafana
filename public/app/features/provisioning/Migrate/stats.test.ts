import { type ResourceStats } from 'app/api/clients/provisioning/v0alpha1';

import { resourceKindInfos } from '../utils/resourceKinds';

import { computeFolderCounts, computeKindTotals, percent } from './stats';

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

describe('computeKindTotals', () => {
  it('returns one totals entry per kind, in order', () => {
    const totals = computeKindTotals(stats, [resourceKindInfos.dashboard, resourceKindInfos.playlist]);
    expect(totals.map((t) => t.kind.kind)).toEqual(['Dashboard', 'Playlist']);
  });

  it('sums instance and managed (git sync + other) counts per kind', () => {
    const totals = computeKindTotals(stats, [resourceKindInfos.dashboard, resourceKindInfos.playlist]);
    expect(totals[0].totals).toEqual({ instanceTotal: 100, managed: 50 });
    expect(totals[1].totals).toEqual({ instanceTotal: 20, managed: 5 });
  });

  it('matches on BOTH group and resource so same-group siblings do not leak in', () => {
    // librarypanels share the dashboard group but must not count as dashboards.
    const totals = computeKindTotals(
      {
        instance: [
          { group: 'dashboard.grafana.app', resource: 'dashboards', count: 10 },
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
      },
      [resourceKindInfos.dashboard]
    );
    expect(totals[0].totals).toEqual({ instanceTotal: 10, managed: 4 });
  });

  it('reports zeros when there is no data', () => {
    const totals = computeKindTotals(undefined, [resourceKindInfos.dashboard]);
    expect(totals[0].totals).toEqual({ instanceTotal: 0, managed: 0 });
  });
});

describe('computeFolderCounts', () => {
  it('reports managed and total folder counts', () => {
    expect(computeFolderCounts(stats)).toEqual({ managed: 6, total: 8 });
  });

  it('folds the legacy `folders` group into folder.grafana.app', () => {
    const counts = computeFolderCounts({
      instance: [{ group: 'folders', resource: 'folders', count: 5 }],
      managed: [{ kind: 'repo', stats: [{ group: 'folders', resource: 'folders', count: 3 }] }],
    });
    expect(counts).toEqual({ managed: 3, total: 5 });
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
