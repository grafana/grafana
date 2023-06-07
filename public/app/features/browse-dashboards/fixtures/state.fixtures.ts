import { DashboardViewItem } from 'app/features/search/types';

import { DashboardViewItemCollection } from '../types';

export function fullyLoadedViewItemCollection(items: DashboardViewItem[]): DashboardViewItemCollection {
  const lastKind = items.at(-1)?.kind ?? 'folder';
  if (!lastKind || lastKind === 'panel') {
    throw new Error('invalid items');
  }

  return {
    items,
    lastFetchedKind: lastKind,
    lastFetchedPage: 1,
    lastKindHasMoreItems: false,
    isFullyLoaded: true,
  };
}
