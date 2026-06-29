import { useCallback, useState } from 'react';

import { type SelectableValue } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { Button, Combobox, Field, Input, MultiCombobox, RadioButtonGroup, Stack } from '@grafana/ui';

import { useLabelOptions, useNamespaceAndGroupOptions } from '../../components/rules/Filter/useRuleFilterAutocomplete';
import { SavedSearches } from '../../components/saved-searches/SavedSearches';
import { type SavedSearch } from '../../components/saved-searches/savedSearchesSchema';
import { useRulesFilter } from '../../hooks/useFilteredRules';
import { type RulesFilter, getSearchFilterFromQuery } from '../../search/rulesSearchParser';
import { annotationLabels } from '../../utils/constants';

import {
  FINDING_TYPES,
  type FindingTypeCounts,
  type FindingTypeFilterValue,
  type SeverityFilterValue,
} from './qualityFindingFilters';
import { trackQualitySavedSearchApplied, useQualitySavedSearches } from './useQualitySavedSearches';

// Saved searches applied from the Alert quality tab should link back to it, not the rule list.
const getQualitySearchHref = (search: SavedSearch) =>
  `/alerting/list/quality?search=${encodeURIComponent(search.query)}`;

export interface QualityFilterProps {
  /** Selected severity filter. */
  severity: SeverityFilterValue;
  /** Called when the severity filter changes. */
  onSeverityChange: (severity: SeverityFilterValue) => void;
  /** Selected finding-type filter. */
  findingType: FindingTypeFilterValue;
  /** Called when the finding-type filter changes. */
  onFindingTypeChange: (findingType: FindingTypeFilterValue) => void;
  /** Number of in-scope findings per finding type, used for the quick-filter button counts. */
  findingCounts: FindingTypeCounts;
  /** Resets the severity/finding-type filters (called alongside clearing the URL filters). */
  onClearExtraFilters: () => void;
}

/**
 * Filter bar for the Alert quality tab: filter by folder, label and rule name (persisted in
 * the URL via useRulesFilter), plus severity and finding-type quick filters (local UI state
 * owned by the tab). Saved searches are persisted per-user via useQualitySavedSearches.
 */
export function QualityFilter({
  severity,
  onSeverityChange,
  findingType,
  onFindingTypeChange,
  findingCounts,
  onClearExtraFilters,
}: QualityFilterProps) {
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

  const severityOptions: Array<SelectableValue<SeverityFilterValue>> = [
    { label: t('alerting.quality.filter.severity-all', 'All'), value: 'all' },
    { label: t('alerting.quality.filter.severity-high', 'High'), value: 'high' },
    { label: t('alerting.quality.filter.severity-medium', 'Medium'), value: 'medium' },
    { label: t('alerting.quality.filter.severity-low', 'Low'), value: 'low' },
  ];

  const hasExtraActiveFilters = severity !== 'all' || findingType !== 'all';
  const showClear = hasActiveFilters || hasExtraActiveFilters;

  const handleClearAll = () => {
    clearAll();
    onClearExtraFilters();
  };

  return (
    <Stack direction="column" gap={1}>
      <Stack direction="row" gap={1} alignItems="flex-end" wrap="wrap">
        {/* Remount the controls when the query changes externally (clear filters, navigation)
            so their values always reflect the current URL state. */}
        <QualityFilterControls key={searchQuery} filterState={filterState} updateFilters={updateFilters} />
        <Field noMargin label={t('alerting.quality.filter.severity-label', 'Severity')}>
          <RadioButtonGroup options={severityOptions} value={severity} onChange={onSeverityChange} />
        </Field>
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
        {showClear && (
          <Button variant="secondary" onClick={handleClearAll}>
            <Trans i18nKey="alerting.quality.filter.clear">Clear filters</Trans>
          </Button>
        )}
      </Stack>
      <Stack
        direction="row"
        gap={1}
        wrap="wrap"
        alignItems="center"
        role="group"
        aria-label={t('alerting.quality.filter.finding-type-group', 'Filter by finding type')}
      >
        {FINDING_TYPES.map((type) => {
          const isActive = findingType === type;
          return (
            <Button
              key={type}
              size="sm"
              variant={isActive ? 'primary' : 'secondary'}
              fill={isActive ? 'solid' : 'outline'}
              aria-pressed={isActive}
              onClick={() => onFindingTypeChange(isActive ? 'all' : type)}
            >
              {t('alerting.quality.filter.finding-type-count', '{{total}} missing {{label}}', {
                total: findingCounts[type],
                label: annotationLabels[type],
              })}
            </Button>
          );
        })}
      </Stack>
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
