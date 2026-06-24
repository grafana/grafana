import { useState } from 'react';

import { Trans, t } from '@grafana/i18n';
import { Button, Combobox, Field, Input, MultiCombobox, Stack } from '@grafana/ui';

import { useLabelOptions, useNamespaceAndGroupOptions } from '../../components/rules/Filter/useRuleFilterAutocomplete';
import { useRulesFilter } from '../../hooks/useFilteredRules';
import { type RulesFilter } from '../../search/rulesSearchParser';

/**
 * Filter bar for the Alert quality tab: filter by folder, label and rule name. Filter
 * state lives in the URL (?search=) via useRulesFilter.
 *
 * Saved searches are intentionally hidden for now; the useQualitySavedSearches hook is
 * kept so the bookmark can be re-enabled later.
 */
export function QualityFilter() {
  const { filterState, searchQuery, updateFilters, clearAll, hasActiveFilters } = useRulesFilter();

  return (
    <Stack direction="row" gap={1} alignItems="flex-end" wrap="wrap">
      {/* Remount the controls when the query changes externally (clear filters, navigation)
          so their values always reflect the current URL state. */}
      <QualityFilterControls key={searchQuery} filterState={filterState} updateFilters={updateFilters} />
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
