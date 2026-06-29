import { useCallback, useState } from 'react';

import { Trans, t } from '@grafana/i18n';
import { Button, Combobox, Field, Input, MultiCombobox, Stack } from '@grafana/ui';

import { useLabelOptions, useNamespaceAndGroupOptions } from '../../components/rules/Filter/useRuleFilterAutocomplete';
import { SavedSearches } from '../../components/saved-searches/SavedSearches';
import { type SavedSearch } from '../../components/saved-searches/savedSearchesSchema';
import { useRulesFilter } from '../../hooks/useFilteredRules';
import { type RulesFilter, getSearchFilterFromQuery } from '../../search/rulesSearchParser';

import { trackQualitySavedSearchApplied, useQualitySavedSearches } from './useQualitySavedSearches';

// Saved searches applied from the Alert quality tab should link back to it, not the rule list.
const getQualitySearchHref = (search: SavedSearch) =>
  `/alerting/list/quality?search=${encodeURIComponent(search.query)}`;

/**
 * Filter bar for the Alert quality tab: filter by folder, label and rule name. Filter
 * state lives in the URL (?search=) via useRulesFilter. Saved searches are persisted
 * per-user via useQualitySavedSearches.
 */
export function QualityFilter() {
  const { filterState, searchQuery, updateFilters, clearAll, hasActiveFilters } = useRulesFilter();

  const {
    savedSearches,
    isLoading: savedSearchesLoading,
    saveSearch,
    renameSearch,
    deleteSearch,
    setDefaultSearch,
  } = useQualitySavedSearches();

  const handleApplySearch = useCallback(
    (search: SavedSearch) => {
      updateFilters(getSearchFilterFromQuery(search.query));
      trackQualitySavedSearchApplied(search);
    },
    [updateFilters]
  );

  return (
    <Stack direction="row" gap={1} alignItems="flex-end" wrap="wrap">
      {/* Remount the controls when the query changes externally (clear filters, navigation)
          so their values always reflect the current URL state. */}
      <QualityFilterControls key={searchQuery} filterState={filterState} updateFilters={updateFilters} />
      <SavedSearches
        savedSearches={savedSearches}
        currentSearchQuery={searchQuery}
        onSave={saveSearch}
        onRename={renameSearch}
        onDelete={deleteSearch}
        onApply={handleApplySearch}
        onSetDefault={setDefaultSearch}
        isLoading={savedSearchesLoading}
        getHref={getQualitySearchHref}
      />
      {hasActiveFilters && (
        <Button variant="secondary" onClick={clearAll}>
          <Trans i18nKey="alerting.quality.filter.clear">Clear filters</Trans>
        </Button>
      )}
    </Stack>
  );
}

interface QualityFilterControlsProps {
  filterState: RulesFilter;
  updateFilters: (filter: RulesFilter) => void;
}

function QualityFilterControls({ filterState, updateFilters }: QualityFilterControlsProps) {
  const { namespaceOptions, namespacePlaceholder } = useNamespaceAndGroupOptions();
  const { labelOptions } = useLabelOptions();

  // Rule name applies on blur/Enter (not on every keystroke) so typing doesn't churn the
  // URL and remount the controls mid-edit.
  const [ruleName, setRuleName] = useState(filterState.ruleName ?? '');
  const applyRuleName = () => updateFilters({ ...filterState, ruleName: ruleName.trim() || undefined });

  return (
    <>
      <Field noMargin label={t('alerting.quality.filter.name-label', 'Search by name')}>
        <Input
          value={ruleName}
          onChange={(event) => setRuleName(event.currentTarget.value)}
          onBlur={applyRuleName}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === 'NumpadEnter') {
              event.preventDefault();
              applyRuleName();
            }
          }}
          placeholder={t('alerting.quality.filter.name-placeholder', 'Filter by name...')}
          data-testid="quality-name-filter"
        />
      </Field>
      <Field noMargin label={<Trans i18nKey="alerting.search.property.namespace">Folder / Namespace</Trans>}>
        <Combobox<string>
          options={namespaceOptions}
          value={filterState.namespace ?? null}
          placeholder={namespacePlaceholder}
          isClearable
          onChange={(option) => {
            if (!option?.infoOption) {
              updateFilters({ ...filterState, namespace: option?.value || undefined });
            }
          }}
        />
      </Field>
      <Field noMargin label={<Trans i18nKey="alerting.search.property.labels">Labels</Trans>}>
        <MultiCombobox
          options={labelOptions}
          value={filterState.labels}
          placeholder={t('alerting.rules-filter.placeholder-labels', 'Select labels')}
          onChange={(selections) => {
            updateFilters({ ...filterState, labels: selections.map((selection) => selection.value) });
          }}
        />
      </Field>
    </>
  );
}
