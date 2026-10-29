import { t } from '@grafana/i18n';
import { EmptyState, Stack } from '@grafana/ui';

import { ResultCount } from '../rule-row/ResultCount';
import { RuleListSkeleton } from '../rule-row/RuleListSkeleton';
import { RuleRowList } from '../rule-row/RuleRowList';
import { type RuleSearchFilter } from '../rule-search/ruleSearchFilter';
import { InlineRequestError } from '../shared/InlineRequestError';
import { LoadMoreFooter } from '../shared/LoadMoreFooter';

import { AlertRuleListEntry } from './AlertRuleListEntry';
import { useAlertRuleSearch } from './alertRuleSearch';

interface ListViewProps {
  filter: RuleSearchFilter;
}

export function AlertRulesListView({ filter }: ListViewProps) {
  const { items, isLoading, error, failure, hasMore, isLoadingMore, loadMore, retry, total } =
    useAlertRuleSearch(filter);

  if (isLoading) {
    return (
      <Stack direction="column" gap={0.5}>
        <ResultCount kind="alert" isLoading />
        <RuleListSkeleton />
      </Stack>
    );
  }

  if (error !== undefined) {
    return (
      <InlineRequestError
        title={t('alerting.gma-rule-list.alert-rules.rules-error', 'Failed to load rules')}
        error={error}
        onRetry={retry}
      />
    );
  }

  if (items.length === 0 && !failure) {
    return (
      <EmptyState
        variant="not-found"
        message={t('alerting.gma-rule-list.alert-rules.no-rules', 'No alert rules found')}
      />
    );
  }

  return (
    <Stack direction="column" gap={0.5}>
      <ResultCount kind="alert" total={total} />
      <RuleRowList>
        {items.map((searchHit) => (
          <AlertRuleListEntry key={searchHit.uid} searchHit={searchHit} showFolderPath />
        ))}
      </RuleRowList>
      <LoadMoreFooter
        hasMore={hasMore}
        isLoadingMore={isLoadingMore}
        failure={failure}
        onLoadMore={loadMore}
        onRetry={retry}
      />
    </Stack>
  );
}
