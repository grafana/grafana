import { type FolderRow } from './hooks/useFolderMigrationData';
import { compareFolders } from './sorting';

function folder(uid: string, title: string, dashboardCount: number): FolderRow {
  return { uid, title, dashboardCount, directDashboards: [] };
}

describe('compareFolders', () => {
  const big = folder('big', 'Team A', 2);
  const small = folder('small', 'Zeta', 1);

  it('orders by dashboard count descending then ascending', () => {
    expect(compareFolders(big, small, 'count-desc')).toBeLessThan(0);
    expect(compareFolders(big, small, 'count-asc')).toBeGreaterThan(0);
  });

  it('breaks count ties by title', () => {
    const tie = folder('tie', 'AAA', 2);
    expect(compareFolders(big, tie, 'count-desc')).toBeGreaterThan(0); // "Team A" after "AAA"
    expect(compareFolders(big, tie, 'count-asc')).toBeGreaterThan(0);
  });

  it('orders by title ascending and descending', () => {
    expect(compareFolders(big, small, 'title-asc')).toBeLessThan(0); // Team A before Zeta
    expect(compareFolders(big, small, 'title-desc')).toBeGreaterThan(0);
  });
});
