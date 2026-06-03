import { type NavModelItem } from '@grafana/data';

import { NAV_LAYOUT_VERSION, type NavLayoutConfig } from './types';
import { findByUrl } from './navIndex';
import { DEFAULT_PINNED_IDS } from './constants';

export function migrateBookmarkUrlsToLayout(
  bookmarkUrls: string[] | undefined,
  canonicalTree: NavModelItem[]
): NavLayoutConfig | undefined {
  if (!bookmarkUrls?.length) {
    return undefined;
  }

  const pinnedIds: string[] = [];
  for (const url of bookmarkUrls) {
    const item = findByUrl(canonicalTree, url);
    if (item?.id && !pinnedIds.includes(item.id)) {
      pinnedIds.push(item.id);
    }
  }

  if (pinnedIds.length === 0) {
    return undefined;
  }

  return {
    version: NAV_LAYOUT_VERSION,
    pinnedIds,
    order: [...DEFAULT_PINNED_IDS, ...pinnedIds.filter((id) => !DEFAULT_PINNED_IDS.includes(id as (typeof DEFAULT_PINNED_IDS)[number]))],
  };
}

export function resolveLayout(
  layout: NavLayoutConfig | undefined,
  bookmarkUrls: string[] | undefined,
  canonicalTree: NavModelItem[]
): NavLayoutConfig {
  if (layout?.version) {
    return layout;
  }

  const migrated = migrateBookmarkUrlsToLayout(bookmarkUrls, canonicalTree);
  if (migrated) {
    return migrated;
  }

  return { version: NAV_LAYOUT_VERSION };
}
