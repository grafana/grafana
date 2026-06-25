import { type FolderRow } from './hooks/useFolderMigrationData';

export type SortKey = 'count-desc' | 'count-asc' | 'title-asc' | 'title-desc';

export function compareFolders(a: FolderRow, b: FolderRow, key: SortKey): number {
  switch (key) {
    case 'count-desc':
      if (b.resourceCount !== a.resourceCount) {
        return b.resourceCount - a.resourceCount;
      }
      // eslint-disable-next-line @grafana/no-locale-compare
      return a.title.localeCompare(b.title);
    case 'count-asc':
      if (a.resourceCount !== b.resourceCount) {
        return a.resourceCount - b.resourceCount;
      }
      // eslint-disable-next-line @grafana/no-locale-compare
      return a.title.localeCompare(b.title);
    case 'title-asc':
      // eslint-disable-next-line @grafana/no-locale-compare
      return a.title.localeCompare(b.title);
    case 'title-desc':
      // eslint-disable-next-line @grafana/no-locale-compare
      return b.title.localeCompare(a.title);
  }
}
