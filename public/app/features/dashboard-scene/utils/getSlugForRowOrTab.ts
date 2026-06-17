import type { RowItem } from 'app/features/dashboard-scene/scene/layout-rows/RowItem';
import type { TabItem } from 'app/features/dashboard-scene/scene/layout-tabs/TabItem';
import { getSlug } from 'app/features/dashboard-scene/utils/getSlug';

export function getSlugForRowOrTab<T extends TabItem | RowItem>(newItem: T, items: T[]): string {
  const baseSlug = getSlug(newItem);
  const sameSlugs = items.filter((item) => getSlug(item) === baseSlug);

  if (sameSlugs.length > 1) {
    const slugIndex = sameSlugs.findIndex((item) => item === newItem);
    if (slugIndex > 0) {
      return `${baseSlug}__${slugIndex + 1}`;
    }
  }
  return baseSlug;
}
