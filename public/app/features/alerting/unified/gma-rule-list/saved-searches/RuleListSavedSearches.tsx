import { isEqual } from 'lodash';

import { Trans } from '@grafana/i18n';
import { Icon, Stack, Text } from '@grafana/ui';

import { SavedSearches } from '../../components/saved-searches/SavedSearches';
import { type SavedSearch } from '../../components/saved-searches/savedSearchesSchema';
import { type UseGenericSavedSearchesResult } from '../../hooks/useGenericSavedSearches';
import { grafanaRulesNav } from '../../utils/navigation';
import { type RuleSearchSchema } from '../rule-search/filterDefinitions';
import { parse } from '../rule-search/parser';
import { type SharedRuleFilter } from '../rule-search/sharedRuleFilter';
import { type RuleKind } from '../shared/ruleKind';

import { trackSavedSearchApplied } from './useRuleListSavedSearches';

interface RuleListSavedSearchesProps {
  kind: RuleKind;
  /** The applied query. */
  query: string;
  onApply: (query: string) => void;
  savedSearches: UseGenericSavedSearchesResult;
}

export function RuleListSavedSearches({ kind, query, onApply, savedSearches }: RuleListSavedSearchesProps) {
  return (
    <SavedSearches
      savedSearches={savedSearches.savedSearches}
      currentSearchQuery={query}
      onSave={savedSearches.saveSearch}
      onRename={savedSearches.renameSearch}
      onDelete={savedSearches.deleteSearch}
      onSetDefault={savedSearches.setDefaultSearch}
      isLoading={savedSearches.isLoading}
      onApply={(search) => {
        onApply(search.query);
        trackSavedSearchApplied(kind, search);
      }}
      getHref={(search) => grafanaRulesNav.ruleListLink(kind, search.query)}
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
  const parsed = parse(query, schema);
  // The list puts the default first, so it wins when two saved searches read the same.
  const applied = query ? savedSearches.find((search) => isEqual(parse(search.query, schema), parsed)) : undefined;

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
