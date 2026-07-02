import { useCallback, useEffect, useState } from 'react';

import { Trans, t } from '@grafana/i18n';
import { Box, FilterInput, Label, Stack } from '@grafana/ui';

import { SavedSearches } from '../../components/saved-searches/SavedSearches';
import { type SavedSearch } from '../../components/saved-searches/savedSearchesSchema';
import { useRulesFilter } from '../../hooks/useFilteredRules';
import { useURLSearchParams } from '../../hooks/useURLSearchParams';
import { getSearchFilterFromQuery } from '../../search/rulesSearchParser';

import { getQualitySearchHref, savedQueryToParams, serializeQualitySearch } from './qualitySavedSearch';
import { useQualityExtraFilters } from './useQualityExtraFilters';
import { trackQualitySavedSearchApplied, useQualitySavedSearches } from './useQualitySavedSearches';

/**
 * Top search bar for the Alert quality tab. The input edits the rules query (folder / labels /
 * rule name) persisted in the `search` URL param. The Saved searches button stores and applies
 * the full state — rules query plus the sidebar severity / finding-type selections — by
 * serializing all the Alert quality URL params into the saved query.
 */
export function QualityListFilterBar() {
  const { searchQuery, updateFilters } = useRulesFilter();
  const { severity, findingTypes } = useQualityExtraFilters();
  const [, updateQueryParams] = useURLSearchParams();

  const {
    savedSearches,
    isLoading: savedSearchesLoading,
    saveSearch,
    renameSearch,
    deleteSearch,
    setDefaultSearch,
  } = useQualitySavedSearches();

  // Local mirror of the URL query so typing is responsive; applied to the URL on blur/Enter.
  const [query, setQuery] = useState(searchQuery);
  useEffect(() => {
    setQuery(searchQuery);
  }, [searchQuery]);

  const applyQuery = useCallback(
    (next: string) => {
      updateFilters(getSearchFilterFromQuery(next));
    },
    [updateFilters]
  );

  const handleApplySearch = useCallback(
    (search: SavedSearch) => {
      updateQueryParams(savedQueryToParams(search.query));
      trackQualitySavedSearchApplied(search);
    },
    [updateQueryParams]
  );

  // What "Save current search" stores: the rules query plus the active sidebar filters, so
  // applying the search later restores the whole view.
  const currentSearchQuery = serializeQualitySearch({ search: searchQuery, severity, findingTypes });

  return (
    <Stack direction="column" gap={1}>
      <Label htmlFor="qualitySearchInput">
        <Trans i18nKey="alerting.quality.filter.search-label">Search</Trans>
      </Label>
      <Stack direction="row" alignItems="center" gap={1}>
        <Box flex={1}>
          <FilterInput
            id="qualitySearchInput"
            data-testid="quality-search-input"
            placeholder={t('alerting.quality.filter.search-placeholder', 'Search by name or enter filter query...')}
            escapeRegex={false}
            value={query}
            onChange={setQuery}
            onBlur={() => applyQuery(query)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === 'NumpadEnter') {
                event.preventDefault();
                applyQuery(query);
              }
            }}
          />
        </Box>
        <SavedSearches
          savedSearches={savedSearches}
          currentSearchQuery={currentSearchQuery}
          onSave={saveSearch}
          onRename={renameSearch}
          onDelete={deleteSearch}
          onApply={handleApplySearch}
          onSetDefault={setDefaultSearch}
          isLoading={savedSearchesLoading}
          getHref={getQualitySearchHref}
        />
      </Stack>
    </Stack>
  );
}
