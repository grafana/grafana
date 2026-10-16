import { t } from '@grafana/i18n';
import { LoadingPlaceholder, Stack } from '@grafana/ui';

import { RuleRowList } from '../rule-row/RuleRowList';
import { type Criteria } from '../rule-search/criteria';
import { InlineRequestError } from '../shared/InlineRequestError';
import { LoadMoreFooter } from '../shared/LoadMoreFooter';
import { ResultCount } from '../shared/ResultCount';

import { AlertRuleListEntry } from './AlertRuleListEntry';
import { useAlertRuleSearch } from './alertRuleSearch';

interface ListViewProps {
  criteria: Criteria;
}

export function ListView({ criteria }: ListViewProps) {
  const { items, isLoading, error, failure, hasMore, isLoadingMore, loadMore, retry, total } =
    useAlertRuleSearch(criteria);

  if (isLoading) {
    return (
      <Stack direction="column" gap={0.5}>
        <ResultCount kind="alert" isLoading />
        <LoadingPlaceholder text={t('alerting.gma-rule-list.alert-rules.loading-rules', 'Loading rules...')} />
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
    return <div>{t('alerting.gma-rule-list.alert-rules.no-rules', 'No Alert rules found')}</div>;
  }

  return (
    <Stack direction="column" gap={0.5}>
      <ResultCount kind="alert" total={total} />
      <RuleRowList>
        {items.map((hit) => (
          <AlertRuleListEntry key={hit.uid} hit={hit} showFolderPath />
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
