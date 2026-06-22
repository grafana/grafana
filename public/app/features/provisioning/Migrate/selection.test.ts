import { type FolderRow } from './hooks/useFolderMigrationData';
import { isMigratableFolder, resolveSelection } from './selection';

function folder(uid: string, dashboardUids: string[], overrides: Partial<FolderRow> = {}): FolderRow {
  const dashboards = dashboardUids.map((d) => ({ uid: d, title: d, url: `/d/${d}` }));
  return {
    uid,
    title: uid,
    dashboardCount: dashboards.length,
    directDashboards: dashboards,
    allDashboards: dashboards,
    ...overrides,
  };
}

describe('isMigratableFolder', () => {
  it('treats any unmanaged folder as a target, including empty ones', () => {
    expect(isMigratableFolder(folder('with-dashboards', ['d1']))).toBe(true);
    expect(isMigratableFolder(folder('empty', []))).toBe(true);
  });

  it('excludes already-managed folders', () => {
    expect(isMigratableFolder(folder('managed', ['d1'], { managedBy: 'repo' }))).toBe(false);
  });
});

describe('resolveSelection', () => {
  const folders = [folder('a', ['a1', 'a2']), folder('b', ['b1'])];

  it('returns an empty selection when nothing is picked', () => {
    const result = resolveSelection(folders, new Set(), new Set());
    expect(result.items).toBe(0);
    expect(result.resources).toEqual([]);
  });

  it('cascades a selected folder to every dashboard in its subtree', () => {
    const result = resolveSelection(folders, new Set(['a']), new Set());

    expect(result.folders).toBe(1);
    expect(result.items).toBe(1);
    expect(result.dashboards).toBe(2);
    expect(result.resources.map((r) => r.name).sort()).toEqual(['a1', 'a2']);
    expect(result.resources[0]).toMatchObject({ group: 'dashboard.grafana.app', kind: 'Dashboard' });
  });

  it('counts a lone dashboard on top of a selected folder', () => {
    const result = resolveSelection(folders, new Set(['a']), new Set(['b1']));

    // 1 folder + 1 independent dashboard = 2 items; 3 dashboards in the payload.
    expect(result.items).toBe(2);
    expect(result.dashboards).toBe(3);
    expect(result.resources.map((r) => r.name).sort()).toEqual(['a1', 'a2', 'b1']);
  });

  it('does not double-count a dashboard that is also inside a selected folder', () => {
    const result = resolveSelection(folders, new Set(['a']), new Set(['a1']));

    // The folder already covers a1, so the explicit tick adds no extra item
    // and no duplicate resource.
    expect(result.items).toBe(1);
    expect(result.dashboards).toBe(2);
    expect(result.resources.map((r) => r.name).sort()).toEqual(['a1', 'a2']);
  });
});
