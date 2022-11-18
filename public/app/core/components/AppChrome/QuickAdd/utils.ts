import { NavModelItem } from '@grafana/data';

export function findCreateActions(navTree: NavModelItem[]): NavModelItem[] {
  const results: NavModelItem[] = [];
  for (const navItem of navTree) {
    if (navItem.isCreateAction) {
      results.push(navItem);
    }
    if (navItem.children) {
      results.push(...findCreateActions(navItem.children));
    }
  }
  return results;
}
