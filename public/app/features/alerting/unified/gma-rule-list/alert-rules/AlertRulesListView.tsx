import { t } from '@grafana/i18n';
import { EmptyState, Stack } from '@grafana/ui';

import { ResultCount } from '../rule-row/ResultCount';
import { RuleListSkeleton } from '../rule-row/RuleListSkeleton';
import { RuleRowList } from '../rule-row/RuleRowList';
import { FolderSearchLimitNotice } from '../shared/FolderSearchLimitNotice';
import { InlineRequestError } from '../shared/InlineRequestError';
import { LoadMoreFooter } from '../shared/LoadMoreFooter';

import { AlertRuleListEntry } from './AlertRuleListEntry';
import { type AlertRuleFilter } from './alertRuleFilters';
import { useAlertRuleSearch } from './alertRuleSearch';

interface ListViewProps {
  filter: AlertRuleFilter;
}

export function AlertRulesListView({ filter }: ListViewProps) {
  const {
    items,
    noMatchingFolder,
    folderLimitReached,
    isLoading,
    error,
    failure,
    hasMore,
    isLoadingMore,
    loadMore,
    retry,
    total,
  } = useAlertRuleSearch(filter);

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

  return (
    <Stack direction="column" gap={0.5}>
      {folderLimitReached && <FolderSearchLimitNotice />}
      {items.length === 0 && !failure ? (
        <EmptyState
          variant="not-found"
          message={
            noMatchingFolder
              ? t('alerting.gma-rule-list.alert-rules.no-rules-match-folder', 'No alert rules match this folder')
              : t('alerting.gma-rule-list.alert-rules.no-rules', 'No alert rules found')
          }
        />
      ) : (
        <>
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
        </>
      )}
    </Stack>
  );
}
