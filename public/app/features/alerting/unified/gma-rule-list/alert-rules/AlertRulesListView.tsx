import { t } from '@grafana/i18n';
import { LoadingPlaceholder, Stack } from '@grafana/ui';

import { RuleRowList } from '../rule-row/RuleRowList';
import { type Criteria } from '../rule-search/criteria';
import { InlineRequestError } from '../shared/InlineRequestError';
import { LoadMoreFooter } from '../shared/LoadMoreFooter';

import { AlertRuleActions } from './AlertRuleActions';
import { AlertRuleRow } from './AlertRuleRow';
import { useAlertRuleSearch } from './alertRuleSearch';

interface ListViewProps {
  criteria: Criteria;
}

/**
 * List mode: a single flat, title-sorted Alert-rule search with Load more. Every row shows
 * its folder path - no folder-count requests happen here.
 */
export function ListView({ criteria }: ListViewProps) {
  const { items, isLoading, error, failure, hasMore, isLoadingMore, loadMore, retry } = useAlertRuleSearch(criteria);

  if (isLoading) {
    return <LoadingPlaceholder text={t('alerting.gma-rule-list.alert-rules.loading-rules', 'Loading rules...')} />;
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
      <RuleRowList>
        {items.map((hit) => (
          <AlertRuleRow key={hit.uid} hit={hit} showFolderPath actions={<AlertRuleActions ruleUid={hit.uid} />} />
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
