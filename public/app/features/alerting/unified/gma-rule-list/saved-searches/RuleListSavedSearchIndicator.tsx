import { Trans } from '@grafana/i18n';
import { Icon, Stack, Text } from '@grafana/ui';

import { type SavedSearch } from '../../components/saved-searches/savedSearchesSchema';
import { type RuleKind } from '../shared/ruleKind';
import { alertTokens } from '../token-search/alertTokens';
import { parse } from '../token-search/parser';
import { recordingTokens } from '../token-search/recordingTokens';
import { serialize } from '../token-search/serializer';

export interface RuleListSavedSearchIndicatorProps {
  kind: RuleKind;
  /** The canonical form of the current filter. */
  query: string;
  savedSearches: SavedSearch[];
}

/** Names the saved search the current query equals, wherever it came from; renders nothing when none matches. */
export function RuleListSavedSearchIndicator({ kind, query, savedSearches }: RuleListSavedSearchIndicatorProps) {
  const registry = kind === 'alert' ? alertTokens : recordingTokens;
  const applied = query
    ? // The collection lists the default first, so it wins when two saved searches share a query.
      savedSearches.find((search) => serialize(parse(search.query, registry)) === query)
    : undefined;

  if (!applied) {
    return null;
  }

  return (
    <Stack gap={0.5} alignItems="center">
      <Text variant="bodySmall" color="secondary" aria-hidden>
        ·
      </Text>
      <Icon name={applied.isDefault ? 'favorite' : 'bookmark'} size="sm" />
      <Text variant="bodySmall" color="secondary">
        {applied.isDefault ? (
          <Trans i18nKey="alerting.gma-rule-list.saved-searches.applied-default">
            {{ name: applied.name }} (default)
          </Trans>
        ) : (
          applied.name
        )}
      </Text>
    </Stack>
  );
}
