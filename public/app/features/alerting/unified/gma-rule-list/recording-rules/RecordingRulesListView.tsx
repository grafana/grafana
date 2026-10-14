import { t } from '@grafana/i18n';
import { LoadingPlaceholder, Stack } from '@grafana/ui';

import { RuleRowList } from '../rule-row/RuleRowList';
import { type Criteria } from '../rule-search/criteria';
import { InlineRequestError } from '../shared/InlineRequestError';
import { LoadMoreFooter } from '../shared/LoadMoreFooter';

import { RecordingRuleActions } from './RecordingRuleActions';
import { RecordingRuleRow } from './RecordingRuleRow';
import { useRecordingRuleSearch } from './recordingRuleSearch';

interface ListViewProps {
  criteria: Criteria;
}

/**
 * List mode: a single flat, title-sorted Recording-rule search with Load more. Every row shows
 * its folder path - no folder-count requests happen here.
 */
export function ListView({ criteria }: ListViewProps) {
  const { items, isLoading, error, failure, hasMore, isLoadingMore, loadMore, retry } =
    useRecordingRuleSearch(criteria);

  if (isLoading) {
    return <LoadingPlaceholder text={t('alerting.gma-rule-list.recording-rules.loading-rules', 'Loading rules...')} />;
  }

  if (error !== undefined) {
    return (
      <InlineRequestError
        title={t('alerting.gma-rule-list.recording-rules.rules-error', 'Failed to load rules')}
        error={error}
        onRetry={retry}
      />
    );
  }

  if (items.length === 0 && !failure) {
    return <div>{t('alerting.gma-rule-list.recording-rules.no-rules', 'No Recording rules found')}</div>;
  }

  return (
    <Stack direction="column" gap={0.5}>
      <RuleRowList>
        {items.map((hit) => (
          <RecordingRuleRow
            key={hit.uid}
            hit={hit}
            showFolderPath
            actions={<RecordingRuleActions ruleUid={hit.uid} />}
          />
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
