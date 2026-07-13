import { Trans, t } from '@grafana/i18n';
import { Alert, EmptyState, Stack } from '@grafana/ui';

import { type RulesFilter } from '../search/rulesSearchParser';

import LoadMoreHelper from './LoadMoreHelper';
import { AlertRuleListItemSkeleton } from './components/AlertRuleListItemLoader';
import { K8sSearchRuleListItem } from './components/K8sSearchRuleListItem';
import { useK8sRulesSearch } from './hooks/useK8sRulesSearch';

interface FilterViewV3Props {
  filterState: RulesFilter;
}

/**
 * Pure-k8s flat rule list: renders definition-only search hits from `useK8sRulesSearch` with
 * infinite-scroll pagination. No DMA merge, no Prometheus DTOs — the v3 replacement for `FilterView`.
 */
export function FilterViewV3({ filterState }: FilterViewV3Props) {
  const { hits, isLoading, error, hasMore, loadMore } = useK8sRulesSearch(filterState);

  if (error) {
    return (
      <Alert severity="error" title={t('alerting.rule-list.v3.search-error', 'Failed to load rules')}>
        {String(error)}
      </Alert>
    );
  }

  const noRulesFound = hits.length === 0 && !isLoading;
  if (noRulesFound) {
    return (
      <EmptyState variant="not-found" message={t('alerting.rule-list.v3.no-rules-found', 'No matching rules found')}>
        <Trans i18nKey="alerting.rule-list.v3.no-rules-found-body">
          No alert or recording rules matched your current set of filters.
        </Trans>
      </EmptyState>
    );
  }

  return (
    <Stack direction="column" gap={0}>
      <ul aria-label={t('alerting.rule-list.v3.aria-label-rule-list', 'rule list')}>
        {hits.map((hit) => (
          <K8sSearchRuleListItem key={hit.name} hit={hit} />
        ))}
        {isLoading && (
          <>
            <AlertRuleListItemSkeleton />
            <AlertRuleListItemSkeleton />
          </>
        )}
      </ul>
      {hasMore && !isLoading && <LoadMoreHelper handleLoad={loadMore} />}
    </Stack>
  );
}
