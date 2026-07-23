import { useEffect } from 'react';

import { SortOrder, type RichHistorySearchFilters, type RichHistorySettings } from 'app/core/utils/richHistoryTypes';

export interface SeedRichHistoryFiltersOptions {
  starred: boolean;
  isLoadingDatasources: boolean;
  dsListError: boolean;
  activeDatasources: string[];
  richHistorySettings: RichHistorySettings;
  updateFilters: (filtersToUpdate?: Partial<RichHistorySearchFilters>) => void;
}

/**
 * Seeds the initial query-history search filters once, when the datasource list resolves.
 * Shared by the Queries and Starred tabs so the two stay in lockstep (the drift between
 * copies was the root cause of DPRO-205).
 */
export function useSeedRichHistoryFilters({
  starred,
  isLoadingDatasources,
  dsListError,
  activeDatasources,
  richHistorySettings,
  updateFilters,
}: SeedRichHistoryFiltersOptions) {
  // `isLoadingDatasources` flips false exactly once, so this seeds a single time on mount
  // (the datasource list is fetched asynchronously). Re-running on other value changes would
  // clobber user-adjusted filters.
  useEffect(() => {
    if (isLoadingDatasources) {
      return;
    }
    // If the datasource list failed to load and we are restricting to active datasources,
    // we cannot resolve their names. Seeding [] would silently mean "show everything" — the
    // opposite of the setting — so skip seeding and let the tab surface the error instead.
    if (dsListError && richHistorySettings.activeDatasourcesOnly) {
      return;
    }
    const datasourceFilters =
      !richHistorySettings.activeDatasourcesOnly && richHistorySettings.lastUsedDatasourceFilters
        ? richHistorySettings.lastUsedDatasourceFilters
        : activeDatasources;
    const filters: RichHistorySearchFilters = {
      search: '',
      sortOrder: SortOrder.Descending,
      datasourceFilters,
      from: 0,
      to: richHistorySettings.retentionPeriod,
      starred,
    };
    updateFilters(filters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoadingDatasources]);
}
