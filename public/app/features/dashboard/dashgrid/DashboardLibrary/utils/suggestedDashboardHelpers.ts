import { type PluginDashboard } from 'app/types/plugins';

import { type GnetDashboard } from '../types';

interface PageSliceParams {
  currentPage: number;
  pageSize: number;
  filteredProvisioned: PluginDashboard[];
  communityCache: {
    items: Array<GnetDashboard | undefined>;
    totalApiPages: number;
    lastPageItemCount?: number;
  };
}

interface PageSliceResult {
  /** Total number of provisioned dashboards (after filtering) */
  totalProvisionedCount: number;
  /** Estimated total community items based on API page count */
  totalCommunityCount: number;
  /** Combined total across both sources */
  totalMergedCount: number;
  /** Total number of pages needed to display all items */
  totalPages: number;
  /** Provisioned dashboards visible on the current page */
  provisionedSlice: PluginDashboard[];
  /** How many community items are needed to fill the rest of the page */
  communityNeededCount: number;
  /** Start index into the community cache for the current page */
  communityStartIndex: number;
  /** Community dashboards visible on the current page (from cache) */
  communitySlice: GnetDashboard[];
}

export function getPageSlice({
  currentPage,
  pageSize,
  filteredProvisioned,
  communityCache,
}: PageSliceParams): PageSliceResult {
  const totalProvisionedCount = filteredProvisioned.length;
  // Use exact count when the last API page has been fetched, otherwise estimate
  const totalCommunityCount =
    communityCache.lastPageItemCount !== undefined && communityCache.totalApiPages > 0
      ? (communityCache.totalApiPages - 1) * pageSize + communityCache.lastPageItemCount
      : communityCache.totalApiPages * pageSize;
  const totalMergedCount = totalProvisionedCount + totalCommunityCount;
  const totalPages = Math.max(1, Math.ceil(totalMergedCount / pageSize));

  // Window of indices for the current page within the merged list
  const pageStartIndex = (currentPage - 1) * pageSize;
  const pageEndIndex = pageStartIndex + pageSize;

  // Provisioned dashboards that fall within the current page window
  const provisionedSlice = filteredProvisioned.slice(pageStartIndex, Math.min(pageEndIndex, totalProvisionedCount));

  // Remaining slots on the page are filled by community dashboards
  const communityNeededCount = pageSize - provisionedSlice.length;
  // Offset into the community list (skip provisioned items from the global index)
  const communityStartIndex = Math.max(0, pageStartIndex - totalProvisionedCount);

  // Extract community items from the sparse cache array
  const communitySlice: GnetDashboard[] = [];
  if (communityNeededCount > 0) {
    for (let i = communityStartIndex; i < communityStartIndex + communityNeededCount; i++) {
      const item = communityCache.items[i];
      if (item) {
        communitySlice.push(item);
      }
    }
  }

  return {
    totalProvisionedCount,
    totalCommunityCount,
    totalMergedCount,
    totalPages,
    provisionedSlice,
    communityNeededCount,
    communityStartIndex,
    communitySlice,
  };
}
