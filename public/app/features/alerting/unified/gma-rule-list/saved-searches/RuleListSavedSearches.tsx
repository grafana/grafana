import { isEqual, mapValues, sortBy } from 'lodash';

import { Trans } from '@grafana/i18n';
import { Icon, Stack, Text } from '@grafana/ui';

import { SavedSearches } from '../../components/saved-searches/SavedSearches';
import { type SavedSearch } from '../../components/saved-searches/savedSearchesSchema';
import { type UseGenericSavedSearchesResult } from '../../hooks/useGenericSavedSearches';
import { useURLSearchParams } from '../../hooks/useURLSearchParams';
import { grafanaRulesNav } from '../../utils/navigation';
import { type RuleSearchSchema } from '../rule-search/filterDefinitions';
import { type ParsedSearch, parse } from '../rule-search/parser';
import { type SharedRuleFilter } from '../rule-search/sharedRuleFilter';
import { type RuleKind } from '../shared/ruleKind';

import { trackSavedSearchApplied } from './useRuleListSavedSearches';

interface RuleListSavedSearchesProps {
  kind: RuleKind;
  savedSearches: UseGenericSavedSearchesResult;
}

/** Applying a search follows its link, which keeps the other URL parameters, such as the view. */
export function RuleListSavedSearches({ kind, savedSearches }: RuleListSavedSearchesProps) {
  const [queryParams] = useURLSearchParams();

  const linkTo = (search: SavedSearch) => {
    const params = new URLSearchParams(queryParams);
    params.set('search', search.query);
    return grafanaRulesNav.ruleListLink(kind, params);
  };

  return (
    <SavedSearches
      savedSearches={savedSearches.savedSearches}
      currentSearchQuery={queryParams.get('search') ?? ''}
      onSave={savedSearches.saveSearch}
      onRename={savedSearches.renameSearch}
      onDelete={savedSearches.deleteSearch}
      onSetDefault={savedSearches.setDefaultSearch}
      isLoading={savedSearches.isLoading}
      onApply={(search) => trackSavedSearchApplied(kind, search)}
      getHref={linkTo}
    />
  );
}

interface RuleListSavedSearchIndicatorProps<Filter extends SharedRuleFilter> {
  query: string;
  schema: RuleSearchSchema<Filter>;
  savedSearches: SavedSearch[];
}

/**
 * Names the saved search whose query parses the same as the applied one, however the query was set.
 * Issues are compared too, so a query with a rejected token never matches the search without it.
 */
export function RuleListSavedSearchIndicator<Filter extends SharedRuleFilter>({
  query,
  schema,
  savedSearches,
}: RuleListSavedSearchIndicatorProps<Filter>) {
  const parsed = inAnyOrder(parse(query, schema));
  // The list puts the default first, so it wins when two saved searches read the same.
  const applied = query
    ? savedSearches.find((search) => isEqual(inAnyOrder(parse(search.query, schema)), parsed))
    : undefined;

  if (!applied) {
    return null;
  }

  return (
    <Stack gap={0.5} alignItems="center">
      <Text variant="bodySmall" color="secondary" aria-hidden>
        ·
      </Text>
      <Icon name={applied.isDefault ? 'favorite' : 'bookmark'} size="sm" aria-hidden />
      <Text variant="bodySmall" color="secondary">
        {applied.isDefault ? (
          <Trans i18nKey="alerting.gma-rule-list.saved-searches.applied-default" values={{ name: applied.name }}>
            {'{{name}}'} (default)
          </Trans>
        ) : (
          applied.name
        )}
      </Text>
    </Stack>
  );
}

/** Filter values and issues compare as sets, except title words: the title search reads them in order. */
function inAnyOrder<Filter extends SharedRuleFilter>({ filter, issues }: ParsedSearch<Filter>) {
  const byValue = (value: unknown) => JSON.stringify(value);
  return {
    filter: mapValues(filter, (value, key) =>
      Array.isArray(value) && key !== 'text' ? sortBy(value, byValue) : value
    ),
    issues: sortBy(issues, byValue),
  };
}
