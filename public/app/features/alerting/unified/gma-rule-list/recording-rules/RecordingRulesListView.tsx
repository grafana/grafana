import { t } from '@grafana/i18n';
import { EmptyState, Stack } from '@grafana/ui';

import { ResultCount } from '../rule-row/ResultCount';
import { RuleListSkeleton } from '../rule-row/RuleListSkeleton';
import { RuleRowList } from '../rule-row/RuleRowList';
import { InlineRequestError } from '../shared/InlineRequestError';
import { LoadMoreFooter } from '../shared/LoadMoreFooter';

import { RecordingRuleListEntry } from './RecordingRuleListEntry';
import { type RecordingRuleFilter } from './recordingRuleFilters';
import { useRecordingRuleSearch } from './recordingRuleSearch';

interface ListViewProps {
  filter: RecordingRuleFilter;
}

export function RecordingRulesListView({ filter }: ListViewProps) {
  const { items, isLoading, error, failure, hasMore, isLoadingMore, loadMore, retry, total } =
    useRecordingRuleSearch(filter);

  if (isLoading) {
    return (
      <Stack direction="column" gap={0.5}>
        <ResultCount kind="recording" isLoading />
        <RuleListSkeleton />
      </Stack>
    );
  }

  if (error !== undefined) {
    return (
      <InlineRequestError
        title={t('alerting.gma-rule-list.recording-rules.rules-error', 'Failed to load recording rules')}
        error={error}
        onRetry={retry}
      />
    );
  }

  if (items.length === 0 && !failure) {
    return (
      <EmptyState
        variant="not-found"
        message={t('alerting.gma-rule-list.recording-rules.no-rules', 'No recording rules found')}
      />
    );
  }

  return (
    <Stack direction="column" gap={0.5}>
      <ResultCount kind="recording" total={total} />
      <RuleRowList>
        {items.map((searchHit) => (
          <RecordingRuleListEntry key={searchHit.uid} searchHit={searchHit} />
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
